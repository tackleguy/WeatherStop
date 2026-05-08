// Bottom-left chip that shows what the user is currently looking at —
// "RainViewer · Reflectivity" at low zoom, "KFWS · Reflectivity"
// when the per-site WMS is active. When a per-site source is active
// the chip expands into a 5-station "switch site" dropdown so the
// user can pin a different radar.

import { ChevronUp, MapPin, Radio } from 'lucide-react';
import { useMemo, useState } from 'react';
import { nearestNexradSites } from '../../lib/nexradSites';
import { useRadarStore } from '../../store/useRadarStore';

export function LayerInfoCard() {
  const plan = useRadarStore((s) => s.sourcePlan);
  const setManualSite = useRadarStore((s) => s.setManualSite);
  const manualSite = useRadarStore((s) => s.manualSite);
  const center = useRadarStore((s) => s.mapCenter);
  const [open, setOpen] = useState(false);

  const isPerSite = plan?.kind === 'ridge-wms' || plan?.kind === 'level2';
  const nearby = useMemo(() => {
    if (!isPerSite || !center) return [];
    return nearestNexradSites(center[0], center[1], 6);
  }, [isPerSite, center]);

  if (!plan) return null;

  // Banner shown when the active product isn't available in this region
  // (e.g. velocity over Europe). Replaces the chip entirely so the user
  // doesn't think the layer just hasn't loaded yet.
  if (plan.kind === 'unavailable' && plan.unavailableReason) {
    return (
      <div
        className="pointer-events-auto absolute left-3 bottom-[88px] z-10 max-w-[280px] rounded-xl border border-amber-500/30 px-3 py-2 backdrop-blur-md"
        style={{ background: 'rgba(245, 158, 11, 0.12)' }}
      >
        <div className="text-[11px] font-medium text-amber-200">
          {plan.unavailableReason}
        </div>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto absolute left-3 bottom-[88px] z-10 rounded-xl border border-[var(--line-default)] backdrop-blur-md"
      style={{ background: 'var(--glass)' }}
    >
      <button
        type="button"
        onClick={() => isPerSite && setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 ${
          isPerSite ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'
        }`}
        aria-expanded={isPerSite ? open : undefined}
      >
        <Radio
          className="h-3.5 w-3.5 text-[var(--accent,#ff8a3d)]"
          strokeWidth={2}
        />
        <div className="flex flex-col items-start gap-0">
          <span className="text-[12px] font-semibold tracking-tight text-white">
            {plan.label}
          </span>
          {plan.siteName ? (
            <span className="text-[10px] text-[var(--ink-3)]">
              {plan.siteName}, {plan.siteState} · 230 km range
              {manualSite ? ' · pinned' : ''}
            </span>
          ) : (
            <span
              className="text-[10px] text-[var(--ink-3)]"
              dangerouslySetInnerHTML={{ __html: plan.attribution }}
            />
          )}
        </div>
        {isPerSite ? (
          <ChevronUp
            className={`ml-1 h-3 w-3 text-[var(--ink-3)] transition-transform ${
              open ? '' : 'rotate-180'
            }`}
            strokeWidth={2.4}
          />
        ) : null}
      </button>

      {isPerSite && open ? (
        <div className="border-t border-[var(--line-subtle)] px-2 py-2">
          <div className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
            Switch site
          </div>
          <ul className="space-y-0.5">
            {nearby.map(({ site, distanceKm }) => {
              const active = plan.siteId === site.id;
              return (
                <li key={site.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setManualSite(site);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-[11px] transition-colors ${
                      active
                        ? 'bg-white/15 text-white'
                        : 'text-[var(--ink-2)] hover:bg-white/5 hover:text-[var(--ink-1)]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <MapPin
                        className="h-2.5 w-2.5 shrink-0"
                        strokeWidth={2.4}
                        style={{
                          color: active ? 'var(--accent,#ff8a3d)' : 'var(--ink-4)',
                        }}
                      />
                      <span className="font-mono font-semibold">{site.id}</span>
                      <span className="truncate text-[var(--ink-3)]">
                        {site.name}, {site.state}
                      </span>
                    </span>
                    <span data-num className="text-[var(--ink-4)]">
                      {Math.round(distanceKm)} km
                    </span>
                  </button>
                </li>
              );
            })}
            {manualSite ? (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setManualSite(null);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-center rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]"
                >
                  Use nearest (auto)
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
