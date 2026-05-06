// SWR-backed cams feed for a city's coordinates. Cached for 5 minutes
// so flipping between cities doesn't slam the upstream.

import useSWR from 'swr';
import { fetchCamsNear, type CamItem } from '../lib/cams';

interface CamsHook {
  cams: CamItem[];
  loading: boolean;
  error?: Error;
}

export function useCams(
  lat: number | null | undefined,
  lon: number | null | undefined,
  radiusKm = 50,
): CamsHook {
  const key =
    lat == null || lon == null
      ? null
      : `cams|${lat.toFixed(3)},${lon.toFixed(3)}|${radiusKm}`;

  const { data, error, isLoading } = useSWR(
    key,
    () => fetchCamsNear(lat as number, lon as number, { radiusKm }),
    {
      refreshInterval: 5 * 60_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      errorRetryCount: 1,
    },
  );

  return {
    cams: data ?? [],
    loading: isLoading,
    error: error as Error | undefined,
  };
}
