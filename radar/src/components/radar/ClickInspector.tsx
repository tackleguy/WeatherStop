// Map click-to-inspect popup. Shows the lat/lon of the clicked point
// plus any active alerts whose geometry's bbox contains it. Closes on
// outside click or X. Coordinates are read from the store, so RadarMap
// is responsible for setting `inspectAt` on click.

import { Crosshair, MapPin, X } from 'lucide-react';
import { useMemo } from 'react';
import { useAlerts } from '../../hooks/useAlerts';
import { formatLatLon, geometryBBox, pointInBBox } from '../../lib/geo';
import { severityColor } from '../../lib/colorTables';
import { useRadarStore } from '../../store/useRadarStore';

export function ClickInspector() {
  const at = useRadarStore((s) => s.inspectAt);
  const close = useRadarStore((s) => s.setInspectAt);
  const focusAlert = useRadarStore((s) => s.focusAlert);
  const { alerts } = useAlerts();

  const hits = useMemo(() => {
    if (!at) return [];
    return alerts.filter((a) => {
      const bbox = geometryBBox(a.geometry);
      if (!bbox) return false;
      return pointInBBox(at, bbox);
    });
  }, [alerts, at]);

  if (!at) return null;

  return (
    <div
      className="pointer-events-auto absolute left-1/2 bottom-24 z-20 -translate-x-1/2 w-80 rounded-xl border border-[var(--line-default)] backdrop-blur-md"
      style={{ background: 'var(--glass-hi)' }}
    >
      <header className="flex items-center justify-between border-b border-[var(--line-subtle)] px-3 py-2">
        <div className="flex items-center gap-1.5 text-[var(--ink-2)]">
          <Crosshair className="h-3.5 w-3.5" strokeWidth={1.8} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Inspect
          </span>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => close(null)}
          className="grid h-6 w-6 place-items-center rounded text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]"
        >
          <X className="h-3 w-3" strokeWidth={2.2} />
        </button>
      </header>

      <div className="px-3 py-3">
        <div className="flex items-center gap-2 text-[12px] text-[var(--ink-1)]">
          <MapPin className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={2} />
          <span data-num>{formatLatLon(at[1], at[0])}</span>
        </div>

        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
            Active alerts at this point
          </div>
          {hits.length === 0 ? (
            <div className="mt-1 text-[12px] text-[var(--ink-3)]">
              No alerts in effect.
            </div>
          ) : (
            <ul className="mt-2 space-y-1">
              {hits.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      focusAlert(a.id);
                      close(null);
                    }}
                    className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-white/5"
                  >
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: severityColor(a.severity) }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-white">
                        {a.event}
                      </div>
                      <div className="truncate text-[10px] text-[var(--ink-3)]">
                        {a.areaDesc}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
