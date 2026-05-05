// Per-coord deduping cache. Sidebar and main view both pull through this,
// so they always render from the same WeatherSnapshot. The map stores
// in-flight promises as well as resolved values, so concurrent callers
// merge into a single network round-trip.

import { loadWeather } from './normalize';
import type { City, WeatherSnapshot } from '../types';

interface Entry {
  promise: Promise<WeatherSnapshot>;
  expiresAt: number;
}

const cache = new Map<string, Entry>();
const TTL_MS = 10 * 60_000;

function keyFor(city: City) {
  return `${city.latitude.toFixed(4)},${city.longitude.toFixed(4)}`;
}

export function getOrLoad(
  city: City,
  signal?: AbortSignal,
  force = false,
): Promise<WeatherSnapshot> {
  const key = keyFor(city);
  const hit = cache.get(key);
  if (!force && hit && hit.expiresAt > Date.now()) return hit.promise;

  const promise = loadWeather(city, signal).catch((err) => {
    // On failure, evict so the next call retries fresh.
    cache.delete(key);
    throw err;
  });

  cache.set(key, { promise, expiresAt: Date.now() + TTL_MS });
  return promise;
}

export function invalidate(city: City) {
  cache.delete(keyFor(city));
}

export function clearWeatherCache() {
  cache.clear();
}
