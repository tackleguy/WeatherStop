// Compact diagnostics: active source + unavailable reason.
// Toggle from the map chrome (Activity icon).

import { useRadarStore } from '../../store/useRadarStore';
import { FRAME_COUNT, FRAME_INTERVAL_MIN } from '../../store/useRadarStore';

export function DiagnosticsPanel() {
  const open = useRadarStore((s) => s.panelsOpen.diagnostics);
  const setPanelOpen = useRadarStore((s) => s.setPanelOpen);
  const plan = useRadarStore((s) => s.sourcePlan);
  const product = useRadarStore((s) => s.activeProduct);
  const zoom = useRadarStore((s) => s.mapZoom);
  const frame = useRadarStore((s) => s.currentFrameIdx);
  const opacity = useRadarStore((s) => s.overlayOpacity);

  if (!open) return null;

  const ageMin = (FRAME_COUNT - 1 - frame) * FRAME_INTERVAL_MIN;

  return (
    <div
      className="pointer-events-auto w-[260px] rounded-xl border border-[var(--line-default)] p-3 text-[11px] backdrop-blur-[20px]"
      style={{ background: 'var(--glass-hi)' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-2)]">
          Diagnostics
        </div>
        <button
          type="button"
          className="text-[var(--ink-3)] hover:text-[var(--ink-1)]"
          onClick={() => setPanelOpen('diagnostics', false)}
        >
          Close
        </button>
      </div>
      <dl className="space-y-1.5 text-[var(--ink-2)]">
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--ink-3)]">Product</dt>
          <dd className="font-medium text-[var(--ink-1)]">{product}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--ink-3)]">Source</dt>
          <dd className="max-w-[150px] truncate text-right font-medium text-[var(--ink-1)]">
            {plan?.label ?? '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--ink-3)]">Kind</dt>
          <dd>{plan?.kind ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--ink-3)]">Zoom</dt>
          <dd data-num>{zoom.toFixed(1)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--ink-3)]">Frame age</dt>
          <dd data-num>{ageMin === 0 ? 'live' : `${ageMin} min`}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--ink-3)]">Opacity</dt>
          <dd data-num>{Math.round(opacity * 100)}%</dd>
        </div>
        {plan?.siteId ? (
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--ink-3)]">Radar</dt>
            <dd>{plan.siteId}</dd>
          </div>
        ) : null}
        {plan?.unavailableReason ? (
          <div className="mt-2 rounded-md border border-[var(--sev-severe)]/40 bg-[var(--sev-severe)]/10 p-2 text-[var(--sev-severe)]">
            {plan.unavailableReason}
          </div>
        ) : (
          <div className="mt-2 text-[var(--ink-3)]">
            Layer OK — if the map looks empty, scrub time or pan to active weather.
          </div>
        )}
      </dl>
    </div>
  );
}
