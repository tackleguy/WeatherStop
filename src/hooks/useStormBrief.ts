import useSWR from 'swr';
import { useViewport } from './useViewport';
import { fetchStormBrief, type StormBrief } from '../lib/stormBrief';
import { useRadarStore } from '../store/useRadarStore';

export function useStormBrief(enabled = true) {
  const { bboxString } = useViewport();
  const center = useRadarStore((s) => s.mapCenter);
  const place =
    center != null
      ? `${center[1].toFixed(2)}°, ${center[0].toFixed(2)}°`
      : undefined;

  const key =
    enabled && bboxString
      ? `storm-brief:${bboxString}:${place ?? ''}`
      : enabled
        ? 'storm-brief:national'
        : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    key,
    () =>
      fetchStormBrief({
        bbox: bboxString,
        place,
      }),
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      errorRetryCount: 1,
    },
  );

  return {
    brief: data as StormBrief | undefined,
    loading: isLoading,
    refreshing: isValidating,
    error: error as Error | undefined,
    refresh: () => mutate(),
  };
}
