// Two-click distance + bearing ruler. The store carries the active flag
// and the click points; this component renders the floating panel that
// shows the readout. The actual map click handlers live in RadarMap.

import { Ruler, X } from 'lucide-react';
import { useMemo } from 'react';
import {
  bearingCompass,
  bearingDeg,
  haversineMiles,
  prettyDistance,
} from '../../lib/geo';
import { useRadarStore } from '../../store/useRadarStore';

export function DistanceRuler() {
  const active = useRadarStore((s) => s.rulerActive);
  const setActive = useRadarStore((s) => s.setRulerActive);
  const points = useRadarStore((s) => s.rulerPoints);
  const clear = useRadarStore((s) => s.clearRuler);

  const readout = useMemo(() => {
    if (points.length < 2) return null;
    const [a, b] = points;
    const distance = haversineMiles(a[1], a[0], b[1], b[0]);
    const bearing = bearingDeg(a[1], a[0], b[1], b[0]);
    return {
      distance,
      bearing,
      compass: bearingCompass(bearing),
      pretty: prettyDistance(distance),
    };
  }, [points]);

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="pointer-events-auto absolute right-4 bottom-[88px] z-10 flex items-center gap-1 rounded-lg border border-[var(--line-default)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)] backdrop-blur-md hover:text-[var(--ink-1)]"
        style={{ background: 'var(--glass)' }}
        title="Measure distance (R)"
      >
        <Ruler className="h-3.5 w-3.5" strokeWidth={1.8} />
        Ruler
      </button>
    );
  }

  return (
    <div
      className="pointer-events-auto absolute right-4 bottom-[88px] z-10 w-72 rounded-xl border border-[var(--line-default)] backdrop-blur-md"
      style={{ background: 'var(--glass-hi)' }}
    >
      <header className="flex items-center justify-between border-b border-[var(--line-subtle)] px-3 py-2">
        <div className="flex items-center gap-1.5 text-[var(--ink-2)]">
          <Ruler className="h-3.5 w-3.5" strokeWidth={1.8} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Distance
          </span>
        </div>
        <button
          type="button"
          aria-label="Close ruler"
          onClick={() => setActive(false)}
          className="grid h-6 w-6 place-items-center rounded text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]"
        >
          <X className="h-3 w-3" strokeWidth={2.2} />
        </button>
      </header>

      <div className="px-3 py-3">
        {points.length === 0 ? (
          <p className="text-[12px] text-[var(--ink-3)]">
            Click any point on the map to set the start.
          </p>
        ) : points.length === 1 ? (
          <p className="text-[12px] text-[var(--ink-3)]">
            Click a second point to measure.
          </p>
        ) : readout ? (
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <span data-num className="text-2xl font-light text-white">
                {readout.pretty.miles}
              </span>
              <span data-num className="text-[12px] text-[var(--ink-3)]">
                {readout.pretty.km}
              </span>
            </div>
            <div className="text-[11px] text-[var(--ink-3)]">
              <span className="font-semibold uppercase tracking-wider">
                Bearing
              </span>{' '}
              {readout.bearing.toFixed(0)}° ({readout.compass})
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 text-[10px] text-[var(--ink-4)]">
              <div>
                <div className="font-semibold uppercase tracking-wider">A</div>
                <div data-num>
                  {points[0][1].toFixed(3)}, {points[0][0].toFixed(3)}
                </div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wider">B</div>
                <div data-num>
                  {points[1][1].toFixed(3)}, {points[1][0].toFixed(3)}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-[var(--line-subtle)] px-3 py-2">
        <button
          type="button"
          onClick={clear}
          className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)] hover:text-[var(--ink-1)]"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => setActive(false)}
          className="rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-black"
          style={{ background: 'var(--accent)' }}
        >
          Done
        </button>
      </footer>
    </div>
  );
}
