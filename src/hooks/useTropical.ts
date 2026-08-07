// NHC tropical layers — prefer direct MapServer GeoJSON; fall back to proxy.

import useSWR from 'swr';
import { useMemo } from 'react';
import {
  getTropicalProduct,
  nhcLayerQueryUrl,
  normalizeTropicalGeoJSON,
  type TropicalBasin,
  type TropicalProduct,
} from '../lib/nhcTropical';

async function fetchTropical(
  product: TropicalProduct,
): Promise<GeoJSON.FeatureCollection> {
  const def = getTropicalProduct(product);
  const direct = nhcLayerQueryUrl(def.layerId);
  try {
    const res = await fetch(direct, {
      headers: { Accept: 'application/geo+json,application/json' },
    });
    if (res.ok) return (await res.json()) as GeoJSON.FeatureCollection;
  } catch {
    // fall through
  }

  const res = await fetch(`/api/tropical?layer=${def.layerId}`, {
    headers: { Accept: 'application/geo+json' },
  });
  if (!res.ok) throw new Error(`tropical ${res.status}`);
  return (await res.json()) as GeoJSON.FeatureCollection;
}

interface TropicalHook {
  geojson: GeoJSON.FeatureCollection;
  loading: boolean;
  error?: Error;
  refresh: () => void;
}

export function useTropical(
  product: TropicalProduct,
  basin: TropicalBasin,
): TropicalHook {
  const key = `tropical:${product}`;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fetchTropical(product),
    {
      refreshInterval: 300_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      errorRetryCount: 1,
      errorRetryInterval: 5_000,
    },
  );

  const geojson = useMemo(
    () => normalizeTropicalGeoJSON(data, product, basin),
    [data, product, basin],
  );

  return {
    geojson,
    loading: isLoading,
    error: error as Error | undefined,
    refresh: () => mutate(),
  };
}
