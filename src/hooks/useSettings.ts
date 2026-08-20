import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '../types';
import { applyTheme, loadTheme, saveTheme } from '../lib/theme';
import { DEFAULT_MAP_STYLE, type MapStyleId } from '../lib/mapStyles';

const STORAGE_KEY = 'settings-v1';
const MAP_STYLE_KEY = 'ws-map-style-v1';

const DEFAULTS: Settings = {
  temp: 'fahrenheit',
  wind: 'mph',
  distance: 'mi',
  precip: 'inch',
  theme: 'dark',
  mapStyle: DEFAULT_MAP_STYLE,
  localAiEnabled: true,
  localAiUrl: 'http://127.0.0.1:11434',
  localAiModel: 'llama3.2',
};

function loadMapStyle(): MapStyleId {
  try {
    const raw = localStorage.getItem(MAP_STYLE_KEY);
    if (
      raw === 'dark' ||
      raw === 'liberty' ||
      raw === 'positron' ||
      raw === 'bright'
    ) {
      return raw;
    }
  } catch {
    // ignore
  }
  return DEFAULT_MAP_STYLE;
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    return {
      ...DEFAULTS,
      ...parsed,
      theme: loadTheme(),
      mapStyle: loadMapStyle(),
    };
  } catch {
    return { ...DEFAULTS, theme: loadTheme(), mapStyle: loadMapStyle() };
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => load());

  useEffect(() => {
    try {
      const { theme: _t, mapStyle: _m, ...units } = settings;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(units));
      saveTheme(settings.theme);
      localStorage.setItem(MAP_STYLE_KEY, settings.mapStyle);
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => applyTheme('auto');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.theme]);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { settings, update };
}
