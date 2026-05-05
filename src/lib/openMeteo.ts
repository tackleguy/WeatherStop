import type { AirQualityResponse, OpenMeteoRaw } from '../types';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'pressure_msl',
  'cloud_cover',
  'visibility',
  'uv_index',
].join(',');

const HOURLY_FIELDS = [
  'temperature_2m',
  'weather_code',
  'precipitation_probability',
  'precipitation',
  'is_day',
  'wind_speed_10m',
].join(',');

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'sunrise',
  'sunset',
  'uv_index_max',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_direction_10m_dominant',
].join(',');

// Always fetched in the canonical units used inside WeatherData
// (°F / mph / inch). Display layer converts to the user's settings.
export async function fetchOpenMeteoRaw(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<OpenMeteoRaw> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: CURRENT_FIELDS,
    hourly: HOURLY_FIELDS,
    daily: DAILY_FIELDS,
    timezone: 'auto',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    forecast_days: '10',
    timeformat: 'iso8601',
  });

  const res = await fetch(`${FORECAST_URL}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Open-Meteo forecast ${res.status}`);
  return (await res.json()) as OpenMeteoRaw;
}

export async function airQuality(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<AirQualityResponse | undefined> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone',
    timezone: 'auto',
  });

  try {
    const res = await fetch(`${AQ_URL}?${params.toString()}`, { signal });
    if (!res.ok) return undefined;
    return (await res.json()) as AirQualityResponse;
  } catch {
    return undefined;
  }
}
