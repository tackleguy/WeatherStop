// Pill row that toggles which alert categories are visible on the map
// and in the inspector. An empty filter set means "show everything";
// any tags in the set restrict the visible alerts.

import { useMemo } from 'react';
import { useAlerts } from '../../hooks/useAlerts';
import {
  categorizeAlertEvent,
  type AlertCategory,
  useRadarStore,
} from '../../store/useRadarStore';

interface CategoryDef {
  key: AlertCategory;
  label: string;
  color: string;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'tornado', label: 'Tornado', color: '#d946ef' },
  { key: 'severe-thunderstorm', label: 'Severe T-Storm', color: '#ef4444' },
  { key: 'flash-flood', label: 'Flood', color: '#3b82f6' },
  { key: 'winter', label: 'Winter', color: '#67e8f9' },
  { key: 'special', label: 'SPS', color: '#94a3b8' },
  { key: 'other', label: 'Other', color: '#cbd5e1' },
];

export function AlertFilterChips() {
  const filter = useRadarStore((s) => s.alertFilter);
  const toggle = useRadarStore((s) => s.toggleAlertCategory);
  const clear = useRadarStore((s) => s.clearAlertFilter);
  const { alerts } = useAlerts();

  // Compute live counts per category so the chip shows "Tornado · 3".
  const counts = useMemo(() => {
    const out: Record<AlertCategory, number> = {
      tornado: 0,
      'severe-thunderstorm': 0,
      'flash-flood': 0,
      winter: 0,
      special: 0,
      other: 0,
    };
    for (const a of alerts) {
      const c = categorizeAlertEvent(a.event);
      out[c] += 1;
    }
    return out;
  }, [alerts]);

  const isAll = filter.size === 0;

  return (
    <div
      className="pointer-events-auto absolute left-4 top-3 z-10 flex max-w-[60vw] flex-wrap items-center gap-1.5 rounded-lg border border-[var(--line-default)] p-1.5 backdrop-blur-md"
      style={{ background: 'var(--glass)' }}
    >
      <button
        type="button"
        onClick={clear}
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
          isAll
            ? 'bg-[var(--accent)] text-black'
            : 'text-[var(--ink-2)] hover:bg-white/5'
        }`}
      >
        All
      </button>
      {CATEGORIES.map((c) => {
        const active = filter.has(c.key);
        const count = counts[c.key];
        const dim = !isAll && !active;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => toggle(c.key)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              active ? 'text-black' : 'text-[var(--ink-2)] hover:bg-white/5'
            } ${dim ? 'opacity-50' : ''}`}
            style={
              active
                ? {
                    background: c.color,
                    boxShadow: `0 0 10px ${c.color}66`,
                  }
                : undefined
            }
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: c.color }}
            />
            {c.label}
            {count > 0 ? (
              <span data-num className="opacity-70">
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
