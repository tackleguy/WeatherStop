// Compact basemap picker for the map chrome.

import { Layers } from 'lucide-react';
import { useState } from 'react';
import { MAP_STYLES, type MapStyleId } from '../../lib/mapStyles';
import { useSettings } from '../../hooks/useSettings';

export function BasemapControl() {
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line-default)] px-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)] backdrop-blur-md transition-colors hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]"
        style={{ background: 'var(--glass-hi)' }}
        aria-expanded={open}
        title="Basemap style"
      >
        <Layers className="h-3.5 w-3.5" strokeWidth={1.8} />
        Map
      </button>
      {open ? (
        <div
          className="absolute right-0 top-11 z-30 w-40 overflow-hidden rounded-xl border border-[var(--line-default)] py-1 shadow-lg backdrop-blur-md"
          style={{ background: 'var(--glass-hi)' }}
        >
          {MAP_STYLES.map((style) => {
            const active = settings.mapStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => {
                  update('mapStyle', style.id as MapStyleId);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12px] transition-colors ${
                  active
                    ? 'bg-[var(--hover-fill)] font-semibold text-[var(--ink-1)]'
                    : 'text-[var(--ink-2)] hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]'
                }`}
              >
                {style.label}
                {active ? (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: 'var(--accent)' }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
