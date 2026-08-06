// SPC outlooks — prefer direct SPC GeoJSON (CORS *) so `npm run dev`
// works; fall back to /api/outlooks when available.

import useSWR from 'swr';
import { useMemo } from 'react';
import {
  normalizeOutlookGeoJSON,
  spcGeoJsonUrl,
  type OutlookDay,
  type OutlookProduct,
} from '../lib/spcOutlooks';

async function fetchOutlook(
  day: OutlookDay,
  product: OutlookProduct,
): Promise<GeoJSON.FeatureCollection> {
  const direct = spcGeoJsonUrl(day, product);
  if (direct) {
    try {
      const res = await fetch(direct, {
        headers: { Accept: 'application/geo+json' },
      });
      if (res.ok) return (await res.json()) as GeoJSON.FeatureCollection;
    } catch {
      // fall through to API proxy
    }
  }

  const res = await fetch(`/api/outlooks?day=${day}&product=${product}`, {
    headers: { Accept: 'application/geo+json' },
  });
  if (!res.ok) throw new Error(`outlooks ${res.status}`);
  return (await res.json()) as GeoJSON.FeatureCollection;
}

interface OutlooksHook {
  geojson: GeoJSON.FeatureCollection;
  loading: boolean;
  error?: Error;
  refresh: () => void;
}

export function useOutlooks(
  day: OutlookDay,
  product: OutlookProduct,
): OutlooksHook {
  const key = `outlooks:${day}:${product}`;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fetchOutlook(day, product),
    {
      refreshInterval: 300_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      errorRetryCount: 1,
      errorRetryInterval: 5_000,
    },
  );

  const geojson = useMemo(
    () => normalizeOutlookGeoJSON(data, product),
    [data, product],
  );

  return {
    geojson,
    loading: isLoading,
    error: error as Error | undefined,
    refresh: () => mutate(),
  };
}
