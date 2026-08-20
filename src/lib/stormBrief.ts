export type StormDanger = 'extreme' | 'high' | 'moderate' | 'low';

export interface TrackedStorm {
  id: string;
  event: string;
  type: string;
  danger: StormDanger;
  area: string;
  headline: string;
  expires: string;
  center?: [number, number];
  motionBearing?: number;
  motionMph?: number;
  motionLabel?: string;
}

export interface StormBrief {
  generatedAt: string;
  source: 'nws' | 'nws+ai';
  headline: string;
  summary: string;
  threats: string[];
  actions: string[];
  storms: TrackedStorm[];
  alertCount: number;
  severeCount: number;
  disclaimer: string;
}

export async function fetchStormBrief(opts: {
  bbox?: string | null;
  place?: string;
  signal?: AbortSignal;
}): Promise<StormBrief> {
  const params = new URLSearchParams();
  if (opts.bbox) params.set('bbox', opts.bbox);
  if (opts.place) params.set('place', opts.place);
  const res = await fetch(`/api/storm/brief?${params}`, {
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(detail?.error ?? `storm brief ${res.status}`);
  }
  return (await res.json()) as StormBrief;
}
