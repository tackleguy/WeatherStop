// Pulls active NWS alerts for CONUS. The api.weather.gov endpoint is
// CORS-enabled, so we hit it directly from the browser — no proxy needed
// for the MVP. (When we deploy on Vercel and want server-side caching,
// move to api/alerts.ts.)

import { useCallback, useEffect, useMemo, useState } from 'react';

const ALERTS_URL = 'https://api.weather.gov/alerts/active?status=actual';
const REFRESH_MS = 60_000;

export interface NWSAlert {
  id: string;
  event: string;
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Extreme' | 'Unknown';
  certainty: string;
  urgency: string;
  headline: string;
  description: string;
  instruction?: string;
  areaDesc: string;
  effective: string;
  expires: string;
  geometry: GeoJSON.Geometry | null;
}

export interface AlertsState {
  alerts: NWSAlert[];
  loading: boolean;
  error?: string;
  lastUpdated?: number;
}

interface NWSFeature {
  id: string;
  properties: Record<string, unknown>;
  geometry: GeoJSON.Geometry | null;
}

function parseFeature(f: NWSFeature): NWSAlert {
  const p = f.properties;
  const sev = (p.severity as string | undefined) ?? 'Unknown';
  return {
    id: f.id,
    event: (p.event as string) ?? 'Alert',
    severity: (['Minor', 'Moderate', 'Severe', 'Extreme'].includes(sev)
      ? sev
      : 'Unknown') as NWSAlert['severity'],
    certainty: (p.certainty as string) ?? '',
    urgency: (p.urgency as string) ?? '',
    headline: (p.headline as string) ?? '',
    description: (p.description as string) ?? '',
    instruction: p.instruction as string | undefined,
    areaDesc: (p.areaDesc as string) ?? '',
    effective: (p.effective as string) ?? '',
    expires: (p.expires as string) ?? '',
    geometry: f.geometry,
  };
}

export function useAlerts(): AlertsState & { refresh: () => void } {
  const [state, setState] = useState<AlertsState>({
    alerts: [],
    loading: true,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();

    (async () => {
      try {
        setState((s) => ({ ...s, loading: true }));
        const res = await fetch(ALERTS_URL, {
          signal: ctrl.signal,
          headers: {
            // NWS likes a recognizable User-Agent. Browsers ignore set
            // attempts on this header (forbidden); the Accept hint still
            // helps content negotiation.
            Accept: 'application/geo+json',
          },
        });
        if (!res.ok) throw new Error(`NWS alerts ${res.status}`);
        const json = (await res.json()) as { features: NWSFeature[] };
        setState({
          alerts: (json.features ?? []).map(parseFeature),
          loading: false,
          lastUpdated: Date.now(),
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState((s) => ({
          ...s,
          loading: false,
          error: (err as Error).message ?? 'Failed to load alerts',
        }));
      }
    })();

    return () => ctrl.abort();
  }, [tick]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  return useMemo(() => ({ ...state, refresh }), [state, refresh]);
}

// Severity → color, used by both the map polygon style and the right rail.
export function severityColor(sev: NWSAlert['severity']): string {
  switch (sev) {
    case 'Extreme':
      return '#dc2626'; // red-600
    case 'Severe':
      return '#f97316'; // orange-500
    case 'Moderate':
      return '#eab308'; // yellow-500
    case 'Minor':
      return '#3b82f6'; // blue-500
    default:
      return '#94a3b8'; // slate-400
  }
}

export function severityRank(sev: NWSAlert['severity']): number {
  switch (sev) {
    case 'Extreme':
      return 0;
    case 'Severe':
      return 1;
    case 'Moderate':
      return 2;
    case 'Minor':
      return 3;
    default:
      return 4;
  }
}
