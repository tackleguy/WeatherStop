// National Weather Service (api.weather.gov) source for US cities.
// Adapts NWS responses into the same ForecastResponse shape produced by
// Open-Meteo so consumers don't have to branch on the source. On any
// non-200 response from NWS, callers degrade silently: per-request endpoints
// return null and we either compose around them or fall back to Open-Meteo
// for the entire forecast.

import type { ForecastResponse, Settings } from '../types';
import { forecast as openMeteoForecast } from './openMeteo';
import { isDaytime, sunTimes } from './sunCalc';

const API_BASE = 'https://api.weather.gov';
// User-Agent is a Forbidden Header in browsers and would be silently dropped,
// so we only set Accept. NWS still serves browser requests fine in practice.
const HEADERS: HeadersInit = { Accept: 'application/geo+json' };

const TTL_FORECAST = 30 * 60_000;
const TTL_OBS = 10 * 60_000;
const POINTS_LS_PREFIX = 'nws-points-v1:';

// ── Cache plumbing ──────────────────────────────────────────────────────────

interface PointsData {
  forecast: string;
  forecastHourly: string;
  observationStations: string;
  city?: string;
  state?: string;
  timeZone?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const pointsMemCache = new Map<string, PointsData>();
const forecastCache = new Map<string, CacheEntry<NWSForecastResponse>>();
const obsCache = new Map<string, CacheEntry<NWSObservation>>();

function pointKey(lat: number, lon: number) {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

function loadPointsLS(key: string): PointsData | null {
  try {
    const raw = localStorage.getItem(POINTS_LS_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as PointsData;
  } catch {
    return null;
  }
}

function savePointsLS(key: string, data: PointsData) {
  try {
    localStorage.setItem(POINTS_LS_PREFIX + key, JSON.stringify(data));
  } catch {
    // ignore quota / private mode
  }
}

async function getPoints(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<PointsData> {
  const key = pointKey(lat, lon);

  const mem = pointsMemCache.get(key);
  if (mem) return mem;
  const stored = loadPointsLS(key);
  if (stored) {
    pointsMemCache.set(key, stored);
    return stored;
  }

  const res = await fetch(`${API_BASE}/points/${key}`, {
    headers: HEADERS,
    signal,
  });
  if (!res.ok) throw new Error(`NWS /points ${res.status}`);
  const json = (await res.json()) as PointsRawResponse;
  const data: PointsData = {
    forecast: json.properties.forecast,
    forecastHourly: json.properties.forecastHourly,
    observationStations: json.properties.observationStations,
    city: json.properties.relativeLocation?.properties?.city,
    state: json.properties.relativeLocation?.properties?.state,
    timeZone: json.properties.timeZone,
  };
  pointsMemCache.set(key, data);
  savePointsLS(key, data);
  return data;
}

async function fetchCached<T>(
  url: string,
  ttl: number,
  store: Map<string, CacheEntry<T>>,
  signal?: AbortSignal,
): Promise<T> {
  const hit = store.get(url);
  if (hit && Date.now() - hit.timestamp < ttl) return hit.data;
  const res = await fetch(url, { headers: HEADERS, signal });
  if (!res.ok) throw new Error(`NWS ${url} → ${res.status}`);
  const data = (await res.json()) as T;
  store.set(url, { data, timestamp: Date.now() });
  return data;
}

// ── Mapping helpers ─────────────────────────────────────────────────────────

const DIR_TO_DEG: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

function shortForecastToWMO(text?: string | null): number {
  if (!text) return 1;
  const t = text.toLowerCase();
  if (t.includes('thunder')) return 95;
  if (t.includes('snow') || t.includes('flurries')) return 71;
  if (t.includes('heavy rain')) return 65;
  if (t.includes('rain') || t.includes('shower')) return 61;
  if (t.includes('drizzle')) return 51;
  if (t.includes('fog') || t.includes('haze') || t.includes('smoke')) return 45;
  if (t.includes('mostly cloudy') || t.includes('partly')) return 2;
  if (t.includes('overcast') || t.includes('cloudy')) return 3;
  if (t.includes('mostly sunny') || t.includes('mostly clear')) return 2;
  if (t.includes('clear') || t.includes('sunny') || t.includes('fair')) return 0;
  return 1;
}

function parseWindMph(s?: string | null): number {
  if (!s) return 0;
  const m = s.match(/(\d+)(?:\s*to\s*(\d+))?/);
  if (!m) return 0;
  const lo = parseInt(m[1], 10);
  const hi = m[2] ? parseInt(m[2], 10) : lo;
  return (lo + hi) / 2;
}

function windDirToDeg(s?: string | null): number {
  if (!s) return 0;
  return DIR_TO_DEG[s.toUpperCase()] ?? 0;
}

const cToF = (c: number) => (c * 9) / 5 + 32;
const fToC = (f: number) => ((f - 32) * 5) / 9;
const kmhToMph = (k: number) => k * 0.621371;
const mphToKmh = (m: number) => m * 1.60934;
const inchToMm = (i: number) => i * 25.4;

function tempForUser(f: number, settings: Settings): number {
  return settings.temp === 'celsius' ? fToC(f) : f;
}
function windForUser(mph: number, settings: Settings): number {
  return settings.wind === 'kmh' ? mphToKmh(mph) : mph;
}
function precipForUser(inches: number, settings: Settings): number {
  return settings.precip === 'mm' ? inchToMm(inches) : inches;
}

// ── Builders ────────────────────────────────────────────────────────────────

function buildSunArrays(lat: number, lon: number, days: number) {
  const sunrise: string[] = [];
  const sunset: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    const t = sunTimes(lat, lon, d);
    sunrise.push(t.sunrise ? t.sunrise.toISOString() : '');
    sunset.push(t.sunset ? t.sunset.toISOString() : '');
  }
  return { sunrise, sunset };
}

interface DailyAccumulator {
  day?: NWSPeriod;
  night?: NWSPeriod;
}

function combinePeriodsToDaily(periods: NWSPeriod[], settings: Settings) {
  const days = new Map<string, DailyAccumulator>();
  for (const p of periods) {
    const dateKey = p.startTime.slice(0, 10);
    const entry = days.get(dateKey) ?? {};
    if (p.isDaytime) entry.day = p;
    else entry.night = p;
    days.set(dateKey, entry);
  }

  const time: string[] = [];
  const weather_code: number[] = [];
  const temperature_2m_max: number[] = [];
  const temperature_2m_min: number[] = [];
  const precipitation_probability_max: number[] = [];
  const wind_speed_10m_max: number[] = [];
  const wind_direction_10m_dominant: number[] = [];

  for (const [date, { day, night }] of days) {
    const ref = day ?? night;
    if (!ref) continue;
    // Anchor each day at noon-ish so date renders correctly across timezones.
    time.push(`${date}T12:00:00`);
    weather_code.push(shortForecastToWMO(ref.shortForecast));

    const dayTempF = day?.temperature ?? night?.temperature ?? 0;
    const nightTempF = night?.temperature ?? day?.temperature ?? 0;
    temperature_2m_max.push(tempForUser(Math.max(dayTempF, nightTempF), settings));
    temperature_2m_min.push(tempForUser(Math.min(dayTempF, nightTempF), settings));

    const popDay = day?.probabilityOfPrecipitation?.value ?? 0;
    const popNight = night?.probabilityOfPrecipitation?.value ?? 0;
    precipitation_probability_max.push(Math.max(popDay, popNight));

    const windMph = Math.max(parseWindMph(day?.windSpeed), parseWindMph(night?.windSpeed));
    wind_speed_10m_max.push(windForUser(windMph, settings));
    wind_direction_10m_dominant.push(
      windDirToDeg(day?.windDirection ?? night?.windDirection),
    );
  }

  return {
    time,
    weather_code,
    temperature_2m_max,
    temperature_2m_min,
    precipitation_probability_max,
    wind_speed_10m_max,
    wind_direction_10m_dominant,
  };
}

function buildHourly(
  periods: NWSPeriod[],
  settings: Settings,
  lat: number,
  lon: number,
) {
  const time: string[] = [];
  const temperature_2m: number[] = [];
  const weather_code: number[] = [];
  const precipitation_probability: number[] = [];
  const precipitation: number[] = [];
  const is_day: number[] = [];

  for (const p of periods) {
    time.push(p.startTime);
    const tempF = p.temperatureUnit === 'F' ? p.temperature : cToF(p.temperature);
    temperature_2m.push(tempForUser(tempF, settings));
    weather_code.push(shortForecastToWMO(p.shortForecast));
    precipitation_probability.push(p.probabilityOfPrecipitation?.value ?? 0);
    precipitation.push(0);
    is_day.push(isDaytime(lat, lon, new Date(p.startTime)) ? 1 : 0);
  }
  return {
    time,
    temperature_2m,
    weather_code,
    precipitation_probability,
    precipitation,
    is_day,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function fetchForecastViaNWS(
  lat: number,
  lon: number,
  settings: Settings,
  signal?: AbortSignal,
): Promise<ForecastResponse> {
  // /points is the entry point. If it fails, fall back to OM entirely.
  let points: PointsData;
  try {
    points = await getPoints(lat, lon, signal);
  } catch (err) {
    console.warn('NWS /points failed, falling back to Open-Meteo', err);
    return openMeteoForecast(lat, lon, settings, signal);
  }

  const [forecastJson, hourlyJson, stationsJson] = await Promise.all([
    fetchCached<NWSForecastResponse>(
      points.forecast,
      TTL_FORECAST,
      forecastCache,
      signal,
    ).catch((e) => {
      console.warn('NWS forecast failed', e);
      return null;
    }),
    fetchCached<NWSForecastResponse>(
      points.forecastHourly,
      TTL_FORECAST,
      forecastCache,
      signal,
    ).catch((e) => {
      console.warn('NWS forecastHourly failed', e);
      return null;
    }),
    fetch(points.observationStations, { headers: HEADERS, signal })
      .then((r) => (r.ok ? (r.json() as Promise<StationsResponse>) : null))
      .catch((e) => {
        console.warn('NWS stations failed', e);
        return null;
      }),
  ]);

  // If both forecast endpoints fail we don't have enough to render. Fall back.
  if (!forecastJson || !hourlyJson) {
    console.warn('NWS forecast endpoints both failed, falling back to Open-Meteo');
    return openMeteoForecast(lat, lon, settings, signal);
  }

  const stationId =
    stationsJson?.features?.[0]?.properties?.stationIdentifier;
  let obs: NWSObservation | null = null;
  if (stationId) {
    obs = await fetchCached<NWSObservation>(
      `${API_BASE}/stations/${stationId}/observations/latest`,
      TTL_OBS,
      obsCache,
      signal,
    ).catch((e) => {
      console.warn('NWS observations failed', e);
      return null;
    });
  }

  const dailyCombined = combinePeriodsToDaily(
    forecastJson.properties.periods,
    settings,
  );
  const hourly = buildHourly(
    hourlyJson.properties.periods.slice(0, 48),
    settings,
    lat,
    lon,
  );
  const sun = buildSunArrays(lat, lon, dailyCombined.time.length);

  const now = new Date();
  const isDayNow = isDaytime(lat, lon, now);

  // Current values: prefer observation, fall back to first hourly period.
  let curTempF: number;
  let curHumidity: number;
  let curWindMph: number;
  let curWindDeg: number;
  let curWindGustMph: number;
  let curPressureHpa: number;
  let curVisibilityM: number;
  let curCode: number;
  let curApparentF: number;

  if (obs) {
    const p = obs.properties;
    curTempF =
      p.temperature.value !== null
        ? cToF(p.temperature.value)
        : hourlyJson.properties.periods[0]?.temperature ?? 60;
    curHumidity = p.relativeHumidity.value ?? 0;
    curWindMph =
      p.windSpeed.value !== null ? kmhToMph(p.windSpeed.value) : 0;
    curWindDeg = p.windDirection.value ?? 0;
    curWindGustMph =
      p.windGust?.value !== null && p.windGust?.value !== undefined
        ? kmhToMph(p.windGust.value)
        : curWindMph * 1.3;
    curPressureHpa =
      p.barometricPressure.value !== null
        ? p.barometricPressure.value / 100
        : 1013;
    curVisibilityM = p.visibility.value ?? 16093;
    curCode = shortForecastToWMO(p.textDescription);
    curApparentF =
      p.heatIndex?.value !== null && p.heatIndex?.value !== undefined
        ? cToF(p.heatIndex.value)
        : p.windChill?.value !== null && p.windChill?.value !== undefined
          ? cToF(p.windChill.value)
          : curTempF;
  } else {
    const h0 = hourlyJson.properties.periods[0];
    curTempF =
      h0?.temperatureUnit === 'F'
        ? h0.temperature
        : h0
          ? cToF(h0.temperature)
          : 60;
    curHumidity = 50;
    curWindMph = parseWindMph(h0?.windSpeed);
    curWindDeg = windDirToDeg(h0?.windDirection);
    curWindGustMph = curWindMph * 1.3;
    curPressureHpa = 1013;
    curVisibilityM = 16093;
    curCode = shortForecastToWMO(h0?.shortForecast);
    curApparentF = curTempF;
  }

  return {
    latitude: lat,
    longitude: lon,
    timezone: points.timeZone ?? 'America/New_York',
    timezone_abbreviation: '',
    utc_offset_seconds: 0,
    current: {
      time: now.toISOString(),
      temperature_2m: tempForUser(curTempF, settings),
      relative_humidity_2m: curHumidity,
      apparent_temperature: tempForUser(curApparentF, settings),
      is_day: isDayNow ? 1 : 0,
      precipitation: 0,
      weather_code: curCode,
      wind_speed_10m: windForUser(curWindMph, settings),
      wind_direction_10m: curWindDeg,
      wind_gusts_10m: windForUser(curWindGustMph, settings),
      pressure_msl: curPressureHpa,
      cloud_cover: 0,
      visibility: curVisibilityM,
      uv_index: 0,
    },
    current_units: {},
    hourly: {
      time: hourly.time,
      temperature_2m: hourly.temperature_2m,
      weather_code: hourly.weather_code,
      precipitation_probability: hourly.precipitation_probability,
      precipitation: hourly.precipitation,
      is_day: hourly.is_day,
    },
    hourly_units: {},
    daily: {
      time: dailyCombined.time,
      weather_code: dailyCombined.weather_code,
      temperature_2m_max: dailyCombined.temperature_2m_max,
      temperature_2m_min: dailyCombined.temperature_2m_min,
      sunrise: sun.sunrise,
      sunset: sun.sunset,
      uv_index_max: dailyCombined.time.map(() => 0),
      precipitation_sum: dailyCombined.time.map(() => precipForUser(0, settings)),
      precipitation_probability_max: dailyCombined.precipitation_probability_max,
      wind_speed_10m_max: dailyCombined.wind_speed_10m_max,
      wind_direction_10m_dominant: dailyCombined.wind_direction_10m_dominant,
    },
    daily_units: {},
  };
}

export interface NWSAlert {
  id: string;
  event: string;
  severity: string;
  headline: string;
  description: string;
  areaDesc: string;
  effective: string;
  expires: string;
}

export async function fetchAlerts(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<NWSAlert[]> {
  try {
    const res = await fetch(
      `${API_BASE}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
      { headers: HEADERS, signal },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as AlertsResponse;
    return (json.features ?? []).map((f) => ({
      id: f.id,
      event: f.properties.event,
      severity: f.properties.severity,
      headline: f.properties.headline,
      description: f.properties.description,
      areaDesc: f.properties.areaDesc,
      effective: f.properties.effective,
      expires: f.properties.expires,
    }));
  } catch {
    return [];
  }
}

// Resolve a city name + state for given coordinates by hitting /points.
// Used for "current location" labelling on US coordinates.
export async function reverseGeocodeUS(
  lat: number,
  lon: number,
): Promise<{ city?: string; state?: string; timeZone?: string } | null> {
  try {
    const points = await getPoints(lat, lon);
    return { city: points.city, state: points.state, timeZone: points.timeZone };
  } catch {
    return null;
  }
}

export { shouldUseNWS } from '../constants/cities';

// ── NWS response shapes ─────────────────────────────────────────────────────

interface PointsRawResponse {
  properties: {
    forecast: string;
    forecastHourly: string;
    observationStations: string;
    timeZone?: string;
    relativeLocation?: {
      properties?: {
        city?: string;
        state?: string;
      };
    };
  };
}

interface NWSPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: 'F' | 'C';
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  probabilityOfPrecipitation?: { value: number | null };
  icon: string;
}

interface NWSForecastResponse {
  properties: { periods: NWSPeriod[] };
}

interface StationsResponse {
  features: { properties: { stationIdentifier: string } }[];
}

interface NWSValue {
  value: number | null;
  unitCode?: string;
}

interface NWSObservation {
  properties: {
    timestamp: string;
    temperature: NWSValue;
    dewpoint: NWSValue;
    windDirection: NWSValue;
    windSpeed: NWSValue;
    windGust?: NWSValue;
    barometricPressure: NWSValue;
    seaLevelPressure?: NWSValue;
    visibility: NWSValue;
    relativeHumidity: NWSValue;
    heatIndex?: NWSValue;
    windChill?: NWSValue;
    textDescription: string;
  };
}

interface AlertsResponse {
  features: {
    id: string;
    properties: {
      event: string;
      severity: string;
      headline: string;
      description: string;
      areaDesc: string;
      effective: string;
      expires: string;
    };
  }[];
}
