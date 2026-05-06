// SWR-driven alerts feed. Polls /api/alerts every 60s; refetches when the
// viewport bbox changes so we filter to what's on screen. Sorted by
// severity (Extreme → Severe → Moderate → Minor → unknown).

import useSWR from 'swr';
import { useEffect } from 'react';
import { useRadarStore } from '../store/useRadarStore';
import { useViewport } from './useViewport';
import { parseAlerts, type AlertRow } from '../lib/nwsAlerts';
import { severityRank } from '../lib/colorTables';

const fetcher = (url: string) =>
  fetch(url, { headers: { Accept: 'application/geo+json' } }).then((r) => {
    if (!r.ok) throw new Error(`alerts ${r.status}`);
    return r.json();
  });

interface AlertsHook {
  alerts: AlertRow[];
  loading: boolean;
  error?: Error;
  refresh: () => void;
}

export function useAlerts(): AlertsHook {
  const { bboxString } = useViewport();
  const setAlertCount = useRadarStore((s) => s.setAlertCount);

  const url = bboxString ? `/api/alerts?bbox=${bboxString}` : '/api/alerts';

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
    // /api routes 503 in `npm run dev` (no Vercel functions). Retry once
    // and stop so the dev console stays quiet; in production this still
    // re-tries on the next 60s tick.
    errorRetryCount: 1,
    errorRetryInterval: 5_000,
  });

  const alerts = parseAlerts(data ?? { features: [] }).sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );

  useEffect(() => {
    setAlertCount(alerts.length);
  }, [alerts.length, setAlertCount]);

  return {
    alerts,
    loading: isLoading,
    error: error as Error | undefined,
    refresh: () => mutate(),
  };
}
