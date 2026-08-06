import useSWR from 'swr';
import { fetchModelsForecast, type ModelHourlySeries } from '../lib/openMeteoModels';
import type { ModelId } from '../constants/models';

interface Hook {
  series: ModelHourlySeries[];
  loading: boolean;
  error?: Error;
  refresh: () => void;
}

export function useModelForecasts(
  lat: number | null,
  lon: number | null,
  modelIds: ModelId[],
): Hook {
  const sorted = [...modelIds].sort().join(',');
  const key =
    lat !== null && lon !== null && modelIds.length > 0
      ? `models:${lat.toFixed(3)}:${lon.toFixed(3)}:${sorted}`
      : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fetchModelsForecast(lat!, lon!, modelIds),
    {
      refreshInterval: 15 * 60_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      errorRetryCount: 1,
    },
  );

  return {
    series: data ?? [],
    loading: isLoading,
    error: error as Error | undefined,
    refresh: () => mutate(),
  };
}
