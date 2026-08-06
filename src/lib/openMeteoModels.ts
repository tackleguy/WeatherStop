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
    const data = (await res.json()) as OpenMeteoModelResponse;
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
