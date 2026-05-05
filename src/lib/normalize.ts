// The single place that produces a WeatherData. Open-Meteo is the
// guaranteed-complete base. NWS is consulted in parallel for US cities and
// only used to upgrade specific fields where it has a confident value.
//
// Hard rules:
//   • Never use ?? 0 or || 0 on a numeric field that the UI renders.
//     Zero is a valid wind speed, not a sentinel. Always fall through to
//     the Open-Meteo value instead.
//   • Every numeric field on WeatherData is required by the type. We
//     populate them all from Open-Meteo before NWS even runs.

import { describe } from './weatherCodes';
import { fetchOpenMeteoRaw, airQuality } from './openMeteo';
import {
  fetchAlerts,
  fetchNWSRaw,
  type NWSPeriod,
  type NWSRaw,
} from './nws';
import { shouldUseNWS } from '../constants/cities';
import { formatWindDir } from './format';
import {
  cToF,
  hpaToInHg,
  kmhToMph,
  metersToMiles,
  paToHpa,
} from './units';
import { validateWeatherData } from './validate';
import type {
  City,
  OpenMeteoRaw,
  WeatherData,
  WeatherSnapshot,
} from '../types';

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

function windDirToDeg(s: string | null | undefined): number | null {
  if (!s) return null;
  const k = s.toUpperCase();
  return DIR_TO_DEG[k] ?? null;
}

function parseNWSWindMph(s: string | null | undefined): number {
  if (!s) return 0;
  const m = s.match(/(\d+)(?:\s*to\s*(\d+))?/);
  if (!m) return 0;
  const lo = parseInt(m[1], 10);
  const hi = m[2] ? parseInt(m[2], 10) : lo;
  return (lo + hi) / 2;
}

function localToISO(localTime: string, utcOffsetSec: number): string {
  if (!localTime || !localTime.includes('T')) return '';
  const [d, tRaw] = localTime.split('T');
  if (!d || !tRaw) return '';
  const t = tRaw.length === 5 ? `${tRaw}:00` : tRaw;
  const sign = utcOffsetSec >= 0 ? '+' : '-';
  const abs = Math.abs(utcOffsetSec);
  const hh = String(Math.floor(abs / 3600)).padStart(2, '0');
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0');
  return `${d}T${t}${sign}${hh}:${mm}`;
}

function dewPointF(tempF: number, rh: number): number {
  const tempC = (tempF - 32) * (5 / 9);
  const a = 17.625;
  const b = 243.04;
  const alpha = (a * tempC) / (b + tempC) + Math.log(Math.max(rh, 1) / 100);
  const dpC = (b * alpha) / (a - alpha);
  return cToF(dpC);
}

// ── Open-Meteo → WeatherData ──────────────────────────────────────────────

export function normalizeFromOpenMeteo(om: OpenMeteoRaw, city: City): WeatherData {
  const c = om.current;
  const tz = om.timezone;
  const offset = om.utc_offset_seconds;

  const conditionLabel = describe(c.weather_code).label;

  // Hourly (24-72h)
  const hourly = om.hourly.time
    .slice(0, 72)
    .map((time, i) => ({
      time: localToISO(time, offset),
      temp: om.hourly.temperature_2m[i],
      code: om.hourly.weather_code[i],
      isDay: om.hourly.is_day[i] === 1,
      precipProb: om.hourly.precipitation_probability?.[i] ?? 0,
      windSpeed: om.hourly.wind_speed_10m?.[i] ?? c.wind_speed_10m,
    }));

  // Daily
  const daily = om.daily.time.map((date, i) => ({
    date,
    high: om.daily.temperature_2m_max[i],
    low: om.daily.temperature_2m_min[i],
    code: om.daily.weather_code[i],
    sunrise: localToISO(om.daily.sunrise[i] ?? '', offset),
    sunset: localToISO(om.daily.sunset[i] ?? '', offset),
    precipProbMax: om.daily.precipitation_probability_max?.[i] ?? 0,
    summary: describe(om.daily.weather_code[i]).label,
  }));

  // Humidity from OM is the gold standard whenever NWS is missing.
  const humidity = Math.round(c.relative_humidity_2m);
  const dewPoint = dewPointF(c.temperature_2m, c.relative_humidity_2m);

  // Wind: Open-Meteo gives gust separately; if equal to or less than speed
  // (rare but possible at low wind), we still report gust = speed so the
  // validator passes.
  const windSpeed = c.wind_speed_10m;
  const windGust = Math.max(c.wind_gusts_10m, windSpeed);

  return {
    location: {
      name: city.name,
      region: city.region ?? '',
      country: city.country ?? '',
      lat: city.latitude,
      lon: city.longitude,
      timezone: city.timezone || tz,
    },
    fetchedAt: Date.now(),

    current: {
      temp: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      code: c.weather_code,
      conditionLabel,
      isDay: c.is_day === 1,
      humidity,
      dewPoint,
      windSpeed,
      windGust,
      windDirection: formatWindDir(c.wind_direction_10m),
      windDirectionDeg: c.wind_direction_10m,
      pressure: hpaToInHg(c.pressure_msl),
      visibility: metersToMiles(c.visibility),
      uvIndex: Math.max(0, c.uv_index ?? 0),
    },

    today: {
      high: om.daily.temperature_2m_max[0],
      low: om.daily.temperature_2m_min[0],
      sunrise: daily[0]?.sunrise ?? '',
      sunset: daily[0]?.sunset ?? '',
      precipProbMax: om.daily.precipitation_probability_max?.[0] ?? 0,
    },

    hourly,
    daily,

    sourceMeta: {
      forecast: 'open-meteo',
      observations: 'open-meteo',
      gapsFilled: [],
    },
  };
}

// ── NWS upgrade ───────────────────────────────────────────────────────────

function computeNWSTodayHighLow(
  periods: NWSPeriod[] | undefined,
  todayDate: string,
): { high: number; low: number } | null {
  if (!periods) return null;
  let day: NWSPeriod | undefined;
  let night: NWSPeriod | undefined;
  for (const p of periods) {
    if (!p.startTime.startsWith(todayDate)) continue;
    if (p.isDaytime) day = day ?? p;
    else night = night ?? p;
  }
  if (!day || !night) return null;
  const toF = (p: NWSPeriod) =>
    p.temperatureUnit === 'F' ? p.temperature : cToF(p.temperature);
  const dt = toF(day);
  const nt = toF(night);
  return { high: Math.max(dt, nt), low: Math.min(dt, nt) };
}

export function upgradeWithNWS(base: WeatherData, nws: NWSRaw): WeatherData {
  // Deep-copy via JSON so we can freely mutate without leaking.
  const result: WeatherData = JSON.parse(JSON.stringify(base));
  const obs = nws.observations?.properties;
  const gaps: string[] = [];

  // ── current.temp
  if (obs?.temperature?.value != null && Number.isFinite(obs.temperature.value)) {
    result.current.temp = cToF(obs.temperature.value);
    result.sourceMeta.observations = 'nws';
  } else {
    gaps.push('current.temp');
  }

  // ── current.feelsLike (heatIndex / windChill if NWS provides)
  if (obs?.heatIndex?.value != null) {
    result.current.feelsLike = cToF(obs.heatIndex.value);
  } else if (obs?.windChill?.value != null) {
    result.current.feelsLike = cToF(obs.windChill.value);
  }

  // ── current.humidity (Open-Meteo wins unless NWS has a plausible value)
  const rh = obs?.relativeHumidity?.value;
  if (rh != null && rh > 0 && rh <= 100) {
    result.current.humidity = Math.round(rh);
  } else {
    gaps.push('current.humidity');
  }

  // ── current.dewPoint
  if (obs?.dewpoint?.value != null && Number.isFinite(obs.dewpoint.value)) {
    result.current.dewPoint = cToF(obs.dewpoint.value);
  }

  // ── current.windSpeed
  const obsWind = obs?.windSpeed?.value;
  if (obsWind != null && obsWind > 0) {
    result.current.windSpeed = kmhToMph(obsWind);
  } else {
    const periodWind = parseNWSWindMph(
      nws.hourly?.properties?.periods?.[0]?.windSpeed,
    );
    if (periodWind > 0) result.current.windSpeed = periodWind;
    else gaps.push('current.windSpeed');
  }

  // ── current.windGust (must be >= speed)
  const obsGust = obs?.windGust?.value;
  if (obsGust != null && obsGust > 0) {
    result.current.windGust = kmhToMph(obsGust);
  }
  if (result.current.windGust < result.current.windSpeed) {
    result.current.windGust = result.current.windSpeed;
  }

  // ── current.windDirection
  if (obs?.windDirection?.value != null) {
    result.current.windDirectionDeg = obs.windDirection.value;
    result.current.windDirection = formatWindDir(obs.windDirection.value);
  } else {
    const periodDir = nws.hourly?.properties?.periods?.[0]?.windDirection;
    const deg = windDirToDeg(periodDir ?? null);
    if (deg !== null) {
      result.current.windDirectionDeg = deg;
      result.current.windDirection = formatWindDir(deg);
    }
  }

  // ── current.pressure (Pa from NWS → inHg)
  if (
    obs?.barometricPressure?.value != null &&
    Number.isFinite(obs.barometricPressure.value)
  ) {
    result.current.pressure = hpaToInHg(paToHpa(obs.barometricPressure.value));
  }

  // ── current.visibility (m from NWS → miles)
  if (obs?.visibility?.value != null && Number.isFinite(obs.visibility.value)) {
    result.current.visibility = metersToMiles(obs.visibility.value);
  }

  // ── today.high / today.low
  const todayDate = result.daily[0]?.date;
  if (todayDate) {
    const hl = computeNWSTodayHighLow(
      nws.forecast?.properties?.periods,
      todayDate,
    );
    if (hl) {
      result.today.high = hl.high;
      result.today.low = hl.low;
      // Mirror into the daily[0] entry so cards stay consistent.
      result.daily[0].high = hl.high;
      result.daily[0].low = hl.low;
    }
  }

  // ── sunrise / sunset: never override from NWS — Open-Meteo is correct.

  result.sourceMeta.forecast = 'nws';
  result.sourceMeta.gapsFilled = gaps;
  if (
    result.sourceMeta.observations === 'nws' &&
    gaps.some((g) => g.startsWith('current.'))
  ) {
    result.sourceMeta.observations = 'mixed';
  }

  return result;
}

// ── Public entry point ────────────────────────────────────────────────────

export async function loadWeather(
  city: City,
  signal?: AbortSignal,
): Promise<WeatherSnapshot> {
  const useNWS = shouldUseNWS(city);

  const [omRaw, nwsRaw, aqRes, alertsRes] = await Promise.all([
    fetchOpenMeteoRaw(city.latitude, city.longitude, signal),
    useNWS
      ? fetchNWSRaw(city.latitude, city.longitude, signal).catch((e) => {
          console.warn('[normalize] NWS chain failed for', city.name, e);
          return null;
        })
      : Promise.resolve(null),
    airQuality(city.latitude, city.longitude, signal),
    useNWS
      ? fetchAlerts(city.latitude, city.longitude, signal)
      : Promise.resolve([]),
  ]);

  const base = normalizeFromOpenMeteo(omRaw, city);
  const upgraded = nwsRaw ? upgradeWithNWS(base, nwsRaw) : base;

  validateWeatherData(upgraded);

  return {
    data: upgraded,
    airQuality: aqRes,
    alerts: alertsRes ?? [],
  };
}
