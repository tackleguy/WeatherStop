import { useCallback, useEffect, useState } from 'react';
import type { City } from '../types';

const STORAGE_KEY = 'cities-v1';

function load(): City[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as City[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function save(cities: City[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cities));
  } catch {
    // Storage may be disabled in private mode; ignore.
  }
}

export function useCities() {
  const [cities, setCities] = useState<City[]>(() => load());

  useEffect(() => {
    save(cities);
  }, [cities]);

  const add = useCallback((city: City) => {
    setCities((prev) => {
      if (prev.some((c) => c.id === city.id)) return prev;
      return [...prev, city];
    });
  }, []);

  const upsertCurrent = useCallback((city: City) => {
    setCities((prev) => {
      const without = prev.filter((c) => !c.isCurrent);
      const ensured: City = { ...city, isCurrent: true, id: 'current' };
      return [ensured, ...without];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setCities((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const reorder = useCallback((from: number, to: number) => {
    setCities((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length)
        return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  return { cities, add, remove, reorder, upsertCurrent };
}
