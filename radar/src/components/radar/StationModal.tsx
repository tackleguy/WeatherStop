// Minimal stub today: pulls /api/stations and lists ICAO + state.
// The full inventory grid + click-to-lock behavior is on the radar
// roadmap; this gets the panel toggle + endpoint reachable so we can
// wire it up later without UI churn.

import useSWR from 'swr';
import { Radio, X } from 'lucide-react';
import { useRadarStore } from '../../store/useRadarStore';

interface StationFeature {
  properties: {
    id: string;
    name: string;
    rda?: { properties?: { mode?: string } };
  };
}

const fetcher = (url: string) =>
  fetch(url, { headers: { Accept: 'application/geo+json' } }).then((r) => {
    if (!r.ok) throw new Error(`stations ${r.status}`);
    return r.json();
  });

export function StationModal() {
  const open = useRadarStore((s) => s.panelsOpen.stations);
  const togglePanel = useRadarStore((s) => s.togglePanel);
  const { data, isLoading } = useSWR<{ features: StationFeature[] }>(
    open ? '/api/stations' : null,
    fetcher,
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => togglePanel('stations')}
    >
      <div
        className="mx-4 flex h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-[var(--line-default)] backdrop-blur-[28px]"
        style={{ background: 'var(--glass-hi)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-12 items-center justify-between border-b border-[var(--line-subtle)] px-5">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-[var(--ink-1)]" strokeWidth={2} />
            <h2 className="text-[13px] font-semibold uppercase tracking-wider">
              NEXRAD Stations
            </h2>
            <span className="text-[11px] text-[var(--ink-3)]">
              {isLoading
                ? 'syncing…'
                : `${data?.features?.length ?? 0} sites`}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => togglePanel('stations')}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-2)] hover:bg-white/5 hover:text-[var(--ink-1)]"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-3">
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
            {(data?.features ?? []).map((f) => {
              const online =
                f.properties.rda?.properties?.mode === 'Operate' ||
                f.properties.rda?.properties?.mode === 'Operational';
              return (
                <li
                  key={f.properties.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--line-subtle)] bg-white/5 px-3 py-2 text-[12px]"
                >
                  <div className="min-w-0">
                    <div className="font-mono font-semibold">{f.properties.id}</div>
                    <div className="truncate text-[10px] text-[var(--ink-3)]">
                      {f.properties.name}
                    </div>
                  </div>
                  <span
                    aria-label={online ? 'online' : 'offline'}
                    className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-500'}`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
