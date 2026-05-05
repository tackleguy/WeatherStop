// National Weather Service raw fetcher. Returns a composite object so the
// normalizer can decide field-by-field which values to trust. Per-endpoint
// failures degrade silently (the field is null and Open-Meteo wins for that
// field). The /points lookup is required: without it we cannot reach the
// other endpoints.

const API_BASE = 'https://api.weather.gov';
const HEADERS: HeadersInit = { Accept: 'application/geo+json' };

const TTL_FORECAST = 30 * 60_000;
const TTL_OBS = 10 * 60_000;
const POINTS_LS_PREFIX = 'nws-points-v1:';

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
    const raw = globalThis.localStorage?.getItem(POINTS_LS_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as PointsData;
  } catch {
    return null;
  }
}

function savePointsLS(key: string, data: PointsData) {
  try {
    globalThis.localStorage?.setItem(POINTS_LS_PREFIX + key, JSON.stringify(data));
  } catch {
    // ignore
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
  const res = await fetch(`${API_BASE}/points/${key}`, { headers: HEADERS, signal });
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

export interface NWSPeriod {
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

export interface NWSForecastResponse {
  properties: { periods: NWSPeriod[] };
}

interface NWSValue {
  value: number | null;
  unitCode?: string;
}

export interface NWSObservation {
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

interface PointsRawResponse {
  properties: {
    forecast: string;
    forecastHourly: string;
    observationStations: string;
    timeZone?: string;
    relativeLocation?: {
      properties?: { city?: string; state?: string };
    };
  };
}

interface StationsResponse {
  features: { properties: { stationIdentifier: string } }[];
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

export interface NWSRaw {
  forecast: NWSForecastResponse | null;
  hourly: NWSForecastResponse | null;
  observations: NWSObservation | null;
  points: PointsData;
}

export async function fetchNWSRaw(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<NWSRaw> {
  const points = await getPoints(lat, lon, signal); // required, throws on failure

  const [forecastJson, hourlyJson, stationsJson] = await Promise.all([
    fetchCached<NWSForecastResponse>(points.forecast, TTL_FORECAST, forecastCache, signal).catch(
      (e) => {
        console.warn('[nws] forecast failed', e);
        return null;
      },
    ),
    fetchCached<NWSForecastResponse>(
      points.forecastHourly,
      TTL_FORECAST,
      forecastCache,
      signal,
    ).catch((e) => {
      console.warn('[nws] forecastHourly failed', e);
      return null;
    }),
    fetch(points.observationStations, { headers: HEADERS, signal })
      .then((r) => (r.ok ? (r.json() as Promise<StationsResponse>) : null))
      .catch((e) => {
        console.warn('[nws] stations failed', e);
        return null;
      }),
  ]);

  let observations: NWSObservation | null = null;
  const stationId = stationsJson?.features?.[0]?.properties?.stationIdentifier;
  if (stationId) {
    observations = await fetchCached<NWSObservation>(
      `${API_BASE}/stations/${stationId}/observations/latest`,
      TTL_OBS,
      obsCache,
      signal,
    ).catch((e) => {
      console.warn('[nws] observations failed', e);
      return null;
    });
  }

  return { forecast: forecastJson, hourly: hourlyJson, observations, points };
}

export interface NWSAlertItem {
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
): Promise<NWSAlertItem[]> {
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
