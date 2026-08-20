import useSWR from 'swr';

export interface ChaserFix {
  available: boolean;
  id: string;
  label: string;
  team?: string;
  vehicle?: string;
  lat?: number;
  lon?: number;
  heading?: number;
  speedMph?: number;
  updatedAt?: string;
  source?: string;
  color?: string;
  trail?: Array<[number, number]>;
  error?: string;
  notes?: string;
}

interface ChasersResponse {
  generatedAt: string;
  liveCount: number;
  chasers: ChaserFix[];
  disclaimer: string;
}

export function useFamousChasers(
  enabled: boolean,
  feedOverridesJson?: string,
  dom3FeedUrl?: string,
) {
  const params = new URLSearchParams();
  if (feedOverridesJson?.trim()) {
    try {
      JSON.parse(feedOverridesJson);
      params.set('feeds', feedOverridesJson.trim());
    } catch {
      // ignore bad JSON
    }
  }
  if (dom3FeedUrl?.trim()) {
    params.set('dom3Feed', dom3FeedUrl.trim());
  }
  const qs = params.toString();
  const key = enabled
    ? `/api/storm/chasers${qs ? `?${qs}` : ''}`
    : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async (url: string) => {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`chasers ${res.status}`);
      return (await res.json()) as ChasersResponse;
    },
    {
      refreshInterval: 25_000,
      revalidateOnFocus: false,
      errorRetryCount: 1,
    },
  );

  return {
    chasers: data?.chasers ?? [],
    liveCount: data?.liveCount ?? 0,
    disclaimer: data?.disclaimer,
    loading: isLoading,
    error: error as Error | undefined,
    refresh: () => mutate(),
  };
}
