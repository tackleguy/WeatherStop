import { useCallback, useEffect, useState } from 'react';
import { shouldUseNWS } from '../constants/cities';
import { airQuality, forecast } from '../lib/openMeteo';
import { fetchAlerts, fetchForecastViaNWS } from '../lib/nws';
import type { City, Settings, WeatherBundle } from '../types';

const REFRESH_MS = 10 * 60_000;

interface State {
  data?: WeatherBundle;
  loading: boolean;
  error?: string;
}

export function useWeather(city: City | undefined, settings: Settings) {
  const [state, setState] = useState<State>(() => ({ loading: !!city }));
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!city) {
      setState({ loading: false });
      return;
    }

    const controller = new AbortController();
    setState({ loading: true });

    (async () => {
      try {
        const useNWS = shouldUseNWS(city);
        const forecastPromise = useNWS
          ? fetchForecastViaNWS(
              city.latitude,
              city.longitude,
              settings,
              controller.signal,
            )
          : forecast(
              city.latitude,
              city.longitude,
              settings,
              controller.signal,
            );

        const alertsPromise = useNWS
          ? fetchAlerts(city.latitude, city.longitude, controller.signal)
          : Promise.resolve(undefined);

        const [forecastRes, airRes, alertsRes] = await Promise.all([
          forecastPromise,
          airQuality(city.latitude, city.longitude, controller.signal),
          alertsPromise,
        ]);

        if (controller.signal.aborted) return;

        setState({
          loading: false,
          data: {
            forecast: forecastRes,
            airQuality: airRes,
            alerts: alertsRes,
            source: useNWS ? 'nws' : 'open-meteo',
            fetchedAt: Date.now(),
          },
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState({
          loading: false,
          error: (err as Error).message ?? 'Failed to load weather',
        });
      }
    })();

    return () => controller.abort();
    // Primitive deps — object refs would let stale data slip through.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    city?.id,
    city?.latitude,
    city?.longitude,
    settings.temp,
    settings.wind,
    settings.precip,
    refreshTick,
  ]);

  // 10-minute auto-refresh while a city is mounted.
  useEffect(() => {
    if (!city) return;
    const id = window.setInterval(
      () => setRefreshTick((n) => n + 1),
      REFRESH_MS,
    );
    return () => window.clearInterval(id);
  }, [city?.id]);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  return { ...state, refresh };
}
