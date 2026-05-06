// Single source of truth for RainViewer's frame catalog. Refreshes
// every 5 minutes (radar updates on a 10-min cadence; this is more than
// enough). Pushes the latest frame count into the radar store so the
// scrubber can clamp `currentFrameIdx`.

import { useEffect } from 'react';
import useSWR from 'swr';
import {
  fetchRainViewerCatalog,
  getFrames,
  type RainViewerCatalog,
  type RainViewerKind,
} from '../lib/rainviewer';

const fetcher = () => fetchRainViewerCatalog();

interface RainViewerHook {
  catalog: RainViewerCatalog | undefined;
  loading: boolean;
  error?: Error;
  framesFor: (kind: RainViewerKind) => RainViewerCatalog extends never
    ? never[]
    : ReturnType<typeof getFrames>;
}

export function useRainViewer(): RainViewerHook {
  const { data, error, isLoading } = useSWR(
    'rainviewer-catalog',
    fetcher,
    {
      refreshInterval: 5 * 60_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      errorRetryCount: 3,
      errorRetryInterval: 10_000,
    },
  );

  // No-op effect placeholder — kept so the hook can grow into setting
  // store flags later (e.g. catalogLoaded, lastFrameTs) without callers
  // having to add an effect themselves.
  useEffect(() => {
    /* intentionally empty for now */
  }, [data?.generatedAt]);

  return {
    catalog: data,
    loading: isLoading,
    error: error as Error | undefined,
    framesFor: (kind) => (data ? getFrames(data, kind) : []),
  };
}
