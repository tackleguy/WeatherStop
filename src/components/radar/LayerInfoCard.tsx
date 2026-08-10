// Bottom-left chip: active source + station stepper for per-site products.

import { ChevronLeft, ChevronRight, ChevronUp, MapPin, Radio } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  nearestNexradSites,
  stepNexradSite,
} from '../../lib/nexradSites';
import { useRadarStore } from '../../store/useRadarStore';

interface Props {
  onFlyToSite?: (lon: number, lat: number) => void;
}

export function LayerInfoCard({ onFlyToSite }: Props) {
  const plan = useRadarStore((s) => s.sourcePlan);
  const setManualSite = useRadarStore((s) => s.setManualSite);
  const manualSite = useRadarStore((s) => s.manualSite);
  const center = useRadarStore((s) => s.mapCenter);
  const [open, setOpen] = useState(false);

  const isPerSite = Boolean(plan?.siteId);
  const nearby = useMemo(() => {
    if (!isPerSite || !center) return [];
    return nearestNexradSites(center[0], center[1], 8);
  }, [isPerSite, center]);

  const activeSite = useMemo(() => {
    if (!plan?.siteId) return null;
    return (
      nearby.find((n) => n.site.id === plan.siteId)?.site ??
      manualSite ??
      null
    );
  }, [plan?.siteId, nearby, manualSite]);

  if (!plan) return null;

  if (plan.kind === 'unavailable' && plan.unavailableReason) {
    return (
      <div
        className="pointer-events-auto max-w-[280px] rounded-xl border border-amber-500/30 px-3 py-2 backdrop-blur-md transition-all duration-[var(--t-base)]"
        style={{ background: 'rgba(245, 158, 11, 0.12)' }}
      >
        <div className="text-[11px] font-medium leading-snug text-amber-200">
          {plan.unavailableReason}
        </div>
      </div>
    );
  }

  const step = (dir: 1 | -1) => {
    if (!activeSite || !center) return;
    const next = stepNexradSite(activeSite, center[0], center[1], dir);
    setManualSite(next);
    onFlyToSite?.(next.lon, next.lat);
  };

  return (
    <div
      className="pointer-events-auto max-w-[340px] rounded-xl border border-[var(--line-default)] backdrop-blur-md transition-all duration-[var(--t-base)]"
      style={{ background: 'var(--glass)' }}
    >
      <div className="flex items-stretch">
        {isPerSite ? (
          <button
            type="button"
            aria-label="Previous radar site"
            onClick={() => step(-1)}
            className="grid w-8 shrink-0 place-items-center border-r border-[var(--line-subtle)] text-[var(--ink-3)] transition-colors hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => isPerSite && setOpen((v) => !v)}
          className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2 transition-colors ${
            isPerSite
              ? 'cursor-pointer hover:bg-[var(--hover-fill)]'
              : 'cursor-default'
          }`}
          aria-expanded={isPerSite ? open : undefined}
        >
          <Radio
            className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
            strokeWidth={2}
          />
          <div className="flex min-w-0 flex-col items-start gap-0">
            <span className="truncate text-[12px] font-semibold leading-snug tracking-tight text-[var(--ink-1)]">
              {plan.label}
            </span>
            {plan.siteName ? (
              <span className="truncate text-[10px] leading-snug text-[var(--ink-3)]">
                {plan.siteName}, {plan.siteState} · 230 km
                {manualSite ? ' · pinned' : ''}
              </span>
            ) : (
              <span
                className="truncate text-[10px] leading-snug text-[var(--ink-3)]"
                dangerouslySetInnerHTML={{ __html: plan.attribution }}
              />
            )}
          </div>
          {isPerSite ? (
            <ChevronUp
              className={`ml-1 h-3 w-3 shrink-0 text-[var(--ink-3)] transition-transform duration-[var(--t-fast)] ${
                open ? '' : 'rotate-180'
              }`}
              strokeWidth={2.4}
            />
          ) : null}
        </button>

        {isPerSite ? (
          <button
            type="button"
            aria-label="Next radar site"
            onClick={() => step(1)}
            className="grid w-8 shrink-0 place-items-center border-l border-[var(--line-subtle)] text-[var(--ink-3)] transition-colors hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>

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
                      onFlyToSite?.(site.lon, site.lat);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-[11px] transition-colors ${
                      active
                        ? 'bg-[var(--hover-fill)] text-[var(--ink-1)]'
                        : 'text-[var(--ink-2)] hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <MapPin
                        className="h-2.5 w-2.5 shrink-0"
                        strokeWidth={2.4}
                        style={{
                          color: active ? 'var(--accent)' : 'var(--ink-4)',
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
                  className="flex w-full items-center justify-center rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)] hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]"
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
