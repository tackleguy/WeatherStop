// Fetch per-model hourly forecasts from Open-Meteo (browser CORS OK).

import {
  getModel,
  modelCoversLocation,
  type ModelId,
  type ModelVariable,
} from '../constants/models';

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

export type ModelStatus =
  /** Usable data returned. */
  | 'ok'
  /** The model's grid does not reach this location. */
  | 'out-of-domain'
  /** Model is known to the API but is currently publishing nothing. */
  | 'no-upstream-data'
  /** Network or HTTP failure. */
  | 'error';

export interface ModelHourlySeries {
  modelId: ModelId;
  status: ModelStatus;
  time: string[];
  values: Partial<Record<ModelVariable, (number | null)[]>>;
  units: Partial<Record<ModelVariable, string>>;
  /** Variables this model actually publishes; others are absent upstream. */
  available: ModelVariable[];
  /** Model generation time when provided by Open-Meteo. */
  generatedAt?: string;
  error?: string;
}

interface OpenMeteoModelResponse {
  error?: boolean;
  reason?: string;
  latitude?: number | null;
  longitude?: number | null;
  hourly?: Record<string, (number | null)[] | string[]>;
  hourly_units?: Record<string, string>;
  generationtime_ms?: number;
}

/**
 * Open-Meteo emits bare `nan` (invalid JSON) for the resolved coordinates when
 * a limited-area model has no grid cell at the requested point. Without this,
 * JSON.parse throws and a routine out-of-domain answer looks like a hard error.
 */
function parseLenient(text: string): OpenMeteoModelResponse | null {
  try {
    return JSON.parse(text) as OpenMeteoModelResponse;
  } catch {
    try {
      const repaired = text
        .replace(/([:,[]\s*)-?nan\b/gi, '$1null')
        .replace(/([:,[]\s*)-?inf(inity)?\b/gi, '$1null');
      return JSON.parse(repaired) as OpenMeteoModelResponse;
    } catch {
      return null;
    }
  }
}

function hasFinite(arr: unknown): arr is (number | null)[] {
  return (
    Array.isArray(arr) &&
    arr.some((v) => typeof v === 'number' && Number.isFinite(v))
  );
}

function empty(
  modelId: ModelId,
  status: ModelStatus,
  error: string,
): ModelHourlySeries {
  return { modelId, status, time: [], values: {}, units: {}, available: [], error };
}

const OUT_OF_DOMAIN_HINT = /no data is available for this location/i;

export async function fetchModelForecast(
  latitude: number,
  longitude: number,
  modelId: ModelId,
  signal?: AbortSignal,
): Promise<ModelHourlySeries> {
  const model = getModel(modelId);

  // Skip the round-trip when the catalog already knows the domain misses.
  if (model && !modelCoversLocation(model, latitude, longitude)) {
    return empty(
      modelId,
      'out-of-domain',
      `Covers ${model.region} — not this location`,
    );
  }

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: HOURLY.join(','),
    models: modelId,
    timezone: 'auto',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    forecast_days: String(model?.horizonDays ?? 7),
    timeformat: 'iso8601',
  });

  let res: Response;
  let text: string;
  try {
    res = await fetch(`${FORECAST_URL}?${params.toString()}`, { signal });
    text = await res.text();
  } catch (err) {
    if (signal?.aborted) throw err;
    return empty(
      modelId,
      'error',
      err instanceof Error ? err.message : 'Fetch failed',
    );
  }

  const data = parseLenient(text);
  if (!data) {
    return empty(modelId, 'error', `Invalid response (HTTP ${res.status})`);
  }

  if (!res.ok || data.error) {
    const reason = data.reason ?? `HTTP ${res.status}`;
    return OUT_OF_DOMAIN_HINT.test(reason)
      ? empty(modelId, 'out-of-domain', 'No grid coverage at this location')
      : empty(modelId, 'error', reason);
  }

  // Repaired `nan` coordinates mean the point fell outside the model grid.
  if (data.latitude == null || data.longitude == null) {
    return empty(modelId, 'out-of-domain', 'No grid coverage at this location');
  }

  const hourly = data.hourly ?? {};
  const time = (hourly.time as string[]) ?? [];
  const values: ModelHourlySeries['values'] = {};
  const units: ModelHourlySeries['units'] = {};
  const available: ModelVariable[] = [];

  for (const key of HOURLY) {
    const arr = hourly[key];
    if (!hasFinite(arr)) continue;
    values[key] = arr;
    available.push(key);
    if (data.hourly_units?.[key]) units[key] = data.hourly_units[key];
  }

  if (time.length === 0 || available.length === 0) {
    return empty(
      modelId,
      'no-upstream-data',
      'Model is not publishing data right now',
    );
  }

  // Requesting the model's full horizon leaves a null tail whenever a run is
  // short; trim it so the shared time axis is not padded with dead hours.
  let last = -1;
  for (const key of available) {
    const arr = values[key]!;
    for (let i = arr.length - 1; i > last; i -= 1) {
      const v = arr[i];
      if (typeof v === 'number' && Number.isFinite(v)) {
        last = i;
        break;
      }
    }
  }
  const end = Math.min(last + 1, time.length);

  return {
    modelId,
    status: 'ok',
    time: time.slice(0, end),
    values: Object.fromEntries(
      available.map((k) => [k, values[k]!.slice(0, end)]),
    ) as ModelHourlySeries['values'],
    units,
    available,
  };
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
