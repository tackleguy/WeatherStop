import { useCallback, useEffect, useState } from 'react';
import { getOrLoad, invalidate } from '../lib/weatherCache';
import type { City, WeatherSnapshot } from '../types';

const REFRESH_MS = 10 * 60_000;

interface State {
  data?: WeatherSnapshot;
  loading: boolean;
  error?: string;
}

export function useWeather(city: City | undefined) {
  const [state, setState] = useState<State>(() => ({ loading: !!city }));
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!city) {
      setState({ loading: false });
      return;
    }

    let cancelled = false;
    setState({ loading: true });

    getOrLoad(city, undefined, refreshTick > 0)
      .then((snapshot) => {
        if (!cancelled) setState({ loading: false, data: snapshot });
      })
      .catch((err: Error) => {
        if (!cancelled) {
          console.error('[useWeather]', city.name, err);
          setState({
            loading: false,
            error: err.message ?? 'Failed to load weather',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [city?.id, city?.latitude, city?.longitude, refreshTick]);

  // Auto-refresh while a city is mounted.
  useEffect(() => {
    if (!city) return;
    const id = window.setInterval(() => {
      invalidate(city);
      setRefreshTick((n) => n + 1);
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [city?.id]);

  const refresh = useCallback(() => {
    if (city) invalidate(city);
    setRefreshTick((n) => n + 1);
  }, [city]);

  return { ...state, refresh };
}
