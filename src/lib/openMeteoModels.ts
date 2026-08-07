// Fetch per-model hourly forecasts from Open-Meteo (browser CORS OK).

import type { ModelId, ModelVariable } from '../constants/models';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const HOURLY: ModelVariable[] = [
  'temperature_2m',
  'precipitation',
  'precipitation_probability',
  'wind_speed_10m',
  'wind_gusts_10m',
  'relative_humidity_2m',
  'cloud_cover',
  'pressure_msl',
];

export interface ModelHourlySeries {
  modelId: ModelId;
  time: string[];
  values: Partial<Record<ModelVariable, (number | null)[]>>;
  units: Partial<Record<ModelVariable, string>>;
  /** Model generation time when provided by Open-Meteo. */
  generatedAt?: string;
  error?: string;
}

interface OpenMeteoModelResponse {
  error?: boolean;
  reason?: string;
  hourly?: Record<string, (number | null)[] | string[]>;
  hourly_units?: Record<string, string>;
  generationtime_ms?: number;
}

export async function fetchModelForecast(
  latitude: number,
  longitude: number,
  modelId: ModelId,
  signal?: AbortSignal,
): Promise<ModelHourlySeries> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: HOURLY.join(','),
    models: modelId,
    timezone: 'auto',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    forecast_days: '7',
    timeformat: 'iso8601',
  });

  try {
    const res = await fetch(`${FORECAST_URL}?${params.toString()}`, { signal });
    const text = await res.text();
    let data: OpenMeteoModelResponse;
    try {
      data = JSON.parse(text) as OpenMeteoModelResponse;
    } catch {
      return {
        modelId,
        time: [],
        values: {},
        units: {},
        error: `Invalid response (HTTP ${res.status})`,
      };
    }
    if (!res.ok || data.error) {
      return {
        modelId,
        time: [],
        values: {},
        units: {},
        error: data.reason ?? `HTTP ${res.status}`,
      };
    }

    const hourly = data.hourly ?? {};
    const time = (hourly.time as string[]) ?? [];
    const values: ModelHourlySeries['values'] = {};
    const units: ModelHourlySeries['units'] = {};
    for (const key of HOURLY) {
      const arr = hourly[key];
      if (Array.isArray(arr) && typeof arr[0] !== 'string') {
        values[key] = arr as (number | null)[];
      }
      if (data.hourly_units?.[key]) units[key] = data.hourly_units[key];
    }

    // All-null / empty series = out of model domain (Open-Meteo often
    // returns HTTP 200 with null arrays instead of an error).
    const primary = values.temperature_2m ?? values.wind_speed_10m;
    const hasData =
      time.length > 0 &&
      primary != null &&
      primary.some((v) => typeof v === 'number' && Number.isFinite(v));
    if (!hasData) {
      return {
        modelId,
        time: [],
        values: {},
        units: {},
        error: 'No data at this location (outside model domain)',
      };
    }

    return { modelId, time, values, units };
  } catch (err) {
    return {
      modelId,
      time: [],
      values: {},
      units: {},
      error: err instanceof Error ? err.message : 'Fetch failed',
    };
  }
}

export async function fetchModelsForecast(
  latitude: number,
  longitude: number,
  modelIds: ModelId[],
  signal?: AbortSignal,
): Promise<ModelHourlySeries[]> {
  // Parallel — Open-Meteo is fine with concurrent model requests.
  return Promise.all(
    modelIds.map((id) => fetchModelForecast(latitude, longitude, id, signal)),
  );
}
