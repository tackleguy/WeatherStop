import useSWR from 'swr';

export interface Dom3Fix {
  available: boolean;
  label: string;
  lat?: number;
  lon?: number;
  heading?: number;
  speedMph?: number;
  updatedAt?: string;
  source?: string;
  trail?: Array<[number, number]>;
  error?: string;
  disclaimer: string;
}

export function useDom3Track(
  enabled: boolean,
  feedUrl?: string,
) {
  const params = new URLSearchParams();
  if (feedUrl?.trim()) params.set('feed', feedUrl.trim());
  const qs = params.toString();
  const key = enabled ? `/api/storm/dom3${qs ? `?${qs}` : ''}` : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async (url: string) => {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`dom3 ${res.status}`);
      return (await res.json()) as Dom3Fix;
    },
    {
      refreshInterval: 20_000,
      revalidateOnFocus: false,
      errorRetryCount: 1,
    },
  );

  return {
    fix: data,
    loading: isLoading,
    error: error as Error | undefined,
    refresh: () => mutate(),
  };
}
