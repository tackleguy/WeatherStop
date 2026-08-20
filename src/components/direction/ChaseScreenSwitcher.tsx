// Shared screen switcher + live nav chip for Direction Radar ↔ Radar.

import { Columns2, Map as MapIcon, Navigation, Radar, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRadarStore } from '../../store/useRadarStore';

const MODES = [
  { id: 'directions' as const, label: 'Directions', icon: MapIcon },
  { id: 'split' as const, label: 'Split', icon: Columns2 },
  { id: 'radar' as const, label: 'Radar', icon: Radar },
];

export function ChaseScreenSwitcher({ className = '' }: { className?: string }) {
  const mode = useRadarStore((s) => s.chaseScreenMode);
  const setMode = useRadarStore((s) => s.setChaseScreenMode);

  return (
    <div
      className={`inline-flex rounded-xl border border-white/10 bg-black/30 p-0.5 ${className}`}
      role="tablist"
      aria-label="Directions and radar layout"
    >
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setMode(m.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
              active
                ? 'bg-cyan-400/25 text-cyan-100'
                : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

export function ActiveNavChip() {
  const navActive = useRadarStore((s) => s.navActive);
  const label = useRadarStore((s) => s.navDestLabel);
  const distanceMi = useRadarStore((s) => s.navDistanceMi);
  const durationMin = useRadarStore((s) => s.navDurationMin);
  const stopNavRoute = useRadarStore((s) => s.stopNavRoute);
  const setChaseScreenMode = useRadarStore((s) => s.setChaseScreenMode);

  if (!navActive) return null;

  return (
    <div className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl border border-cyan-300/25 bg-[color-mix(in_srgb,var(--glass)_92%,#083344)] px-3 py-2 shadow-lg backdrop-blur-xl">
      <Navigation className="h-4 w-4 shrink-0 text-cyan-300" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold text-[var(--ink-1)]">
          Navigating · {label || 'Destination'}
        </div>
        <div className="text-[10px] text-[var(--ink-4)]">
          {distanceMi != null ? `~${distanceMi.toFixed(1)} mi left` : 'En route'}
          {durationMin != null ? ` · ~${Math.round(durationMin)} min` : ''}
        </div>
      </div>
      <Link
        to="/direction-radar"
        onClick={() => setChaseScreenMode('split')}
        className="shrink-0 rounded-lg bg-cyan-400/20 px-2 py-1 text-[10px] font-semibold text-cyan-100"
      >
        Split
      </Link>
      <button
        type="button"
        onClick={() => stopNavRoute()}
        className="shrink-0 rounded-lg bg-white/10 p-1.5 text-[var(--ink-2)]"
        title="End route"
        aria-label="End route"
      >
        <Square className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
