// Fetch AI storm analysis for the current radar viewport.
// Uses NWS alert geometries for boxes/paths and the local LLM for enrichment.

import useSWR from 'swr';
import { analyzeStorms } from '../lib/aiClient';
import type { AlertRow } from '../lib/nwsAlerts';
import type { StormAnalysisResult } from '../lib/stormAnalysis';
import { useRadarStore } from '../store/useRadarStore';

function slimAlerts(alerts: AlertRow[]) {
  return alerts.map((a) => ({
    id: a.id,
    event: a.event,
    severity: a.severity,
    headline: a.headline,
    description: a.description.slice(0, 1200),
    areaDesc: a.areaDesc,
    geometry: a.geometry,
  }));
}

function bboxKey(bbox: [number, number, number, number] | null): string {
  if (!bbox) return 'none';
  // Round so tiny pan jitter doesn't refetch constantly.
  return bbox.map((n) => n.toFixed(2)).join(',');
}

export interface StormAnalysisHook {
  result: StormAnalysisResult | undefined;
  error: Error | undefined;
  isLoading: boolean;
  refresh: () => void;
}

export function useStormAnalysis(alerts: AlertRow[]): StormAnalysisHook {
  const enabled = useRadarStore((s) => s.aiStormsActive);
  const bbox = useRadarStore((s) => s.bbox);

  const key =
    enabled && bbox
      ? (['ai-storm-analysis', bboxKey(bbox), alerts.map((a) => a.id).join('|')] as const)
      : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async () => {
      if (!bbox) throw new Error('Map viewport not ready');
      return analyzeStorms({
        bbox,
        alerts: slimAlerts(alerts),
      });
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      refreshInterval: enabled ? 90_000 : 0,
      keepPreviousData: true,
    },
  );

  return {
    result: data,
    error: error as Error | undefined,
    isLoading: Boolean(enabled && isLoading),
    refresh: () => {
      void mutate();
    },
  };
}
