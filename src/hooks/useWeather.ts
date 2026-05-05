import { useCallback, useEffect, useRef, useState } from 'react';
import { airQuality, forecast } from '../lib/openMeteo';
import type { City, Settings, WeatherBundle } from '../types';

const REFRESH_MS = 10 * 60_000;

interface CacheEntry {
  bundle: WeatherBundle;
  settings: Settings;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(city: City, settings: Settings) {
  return `${city.id}|${settings.temp}|${settings.wind}|${settings.precip}`;
}

interface State {
  data?: WeatherBundle;
  loading: boolean;
  error?: string;
}

export function useWeather(city: City | undefined, settings: Settings) {
  const [state, setState] = useState<State>(() => {
    if (!city) return { loading: false };
    const cached = cache.get(cacheKey(city, settings));
    return {
      loading: !cached,
      data: cached?.bundle,
    };
  });

  const refreshTimer = useRef<number | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);

  const load = useCallback(
    async (target: City, currentSettings: Settings, force = false) => {
      const key = cacheKey(target, currentSettings);
      const cached = cache.get(key);

      if (!force && cached && Date.now() - cached.bundle.fetchedAt < REFRESH_MS) {
        setState({ loading: false, data: cached.bundle });
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((prev) => ({
        loading: !prev.data,
        data: prev.data,
      }));

      try {
        const [forecastRes, airRes] = await Promise.all([
          forecast(target.latitude, target.longitude, currentSettings, controller.signal),
          airQuality(target.latitude, target.longitude, controller.signal),
        ]);
        const bundle: WeatherBundle = {
          forecast: forecastRes,
          airQuality: airRes,
          fetchedAt: Date.now(),
        };
        cache.set(key, { bundle, settings: currentSettings });
        if (!controller.signal.aborted) {
          setState({ loading: false, data: bundle });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState({
          loading: false,
          error: (err as Error).message ?? 'Failed to load weather',
        });
      }
    },
    [],
  );

  useEffect(() => {
    if (!city) return;
    load(city, settings);

    if (refreshTimer.current) window.clearInterval(refreshTimer.current);
    refreshTimer.current = window.setInterval(() => {
      load(city, settings, true);
    }, REFRESH_MS);

    return () => {
      if (refreshTimer.current) window.clearInterval(refreshTimer.current);
      abortRef.current?.abort();
    };
  }, [city, settings, load]);

  const refresh = useCallback(() => {
    if (!city) return;
    load(city, settings, true);
  }, [city, settings, load]);

  return { ...state, refresh };
}
