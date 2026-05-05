import type { GeocodingResult } from '../types';

const URL_BASE = 'https://geocoding-api.open-meteo.com/v1/search';

export async function search(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    name: trimmed,
    count: '10',
    language: 'en',
    format: 'json',
  });

  const res = await fetch(`${URL_BASE}?${params.toString()}`, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: GeocodingResult[] };
  return json.results ?? [];
}

// Lightweight debounce that supports AbortSignal hand-off.
export function debouncedSearch(delay = 300) {
  let timer: number | undefined;
  let controller: AbortController | undefined;

  return (
    query: string,
    onResults: (results: GeocodingResult[]) => void,
    onError?: (err: unknown) => void,
  ) => {
    if (timer) window.clearTimeout(timer);
    if (controller) controller.abort();
    controller = new AbortController();
    const localController = controller;

    timer = window.setTimeout(async () => {
      try {
        const results = await search(query, localController.signal);
        if (!localController.signal.aborted) onResults(results);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') onError?.(err);
      }
    }, delay);
  };
}
