// Floating AI storm tracker — NWS-grounded brief + tracked cells for the map.

import { AnimatePresence, motion } from 'framer-motion';
import {
  BrainCircuit,
  Crosshair,
  Loader2,
  MapPin,
  RefreshCw,
  Route,
  ShieldAlert,
  X,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStormBrief } from '../../hooks/useStormBrief';
import { alertsPageHref } from '../../lib/alertsNav';
import type { StormDanger } from '../../lib/stormBrief';
import { useRadarStore } from '../../store/useRadarStore';

export function StormTrackerPanel() {
  const open = useRadarStore((s) => s.panelsOpen.storm);
  const togglePanel = useRadarStore((s) => s.togglePanel);
  const focusAlert = useRadarStore((s) => s.focusAlert);
  const navigate = useNavigate();
  const { brief, loading, refreshing, error, refresh } = useStormBrief(open);

  const flyToStorm = (id?: string) => {
    if (!id) return;
    focusAlert(id);
    navigate(alertsPageHref(id));
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="storm-tracker"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="absolute bottom-24 left-3 right-3 z-30 mx-auto flex max-h-[min(70vh,560px)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[var(--line-default)] shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-[28px] md:bottom-auto md:left-auto md:right-4 md:top-20 md:max-h-[calc(100vh-8rem)]"
          style={{
            background:
              'linear-gradient(165deg, rgba(14,22,36,0.97), rgba(10,16,28,0.94))',
          }}
        >
          <header className="border-b border-[var(--line-subtle)] px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="section-eyebrow">AI storm tracker</p>
                <div className="mt-1 flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-cyan-300" />
                  <h2 className="text-[15px] font-semibold text-[var(--ink-1)]">
                    Live brief
                  </h2>
                  {brief ? (
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                      {brief.source === 'nws+ai' ? 'NWS + AI' : 'NWS'}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => refresh()}
                  className="control-button h-9 w-9"
                  title="Refresh brief"
                  aria-label="Refresh brief"
                >
                  {refreshing || loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Close storm tracker"
                  onClick={() => togglePanel('storm')}
                  className="control-button h-9 w-9"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            {loading && !brief ? (
              <div className="floating-subpanel flex items-center gap-2 px-3 py-4 text-xs text-[var(--ink-3)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reading NWS alerts for this view…
              </div>
            ) : null}

            {error && !brief ? (
              <div className="floating-subpanel px-3 py-4">
                <p className="text-xs text-red-300">Couldn’t load storm brief.</p>
                <p className="mt-1 text-[10px] text-[var(--ink-4)]">
                  {error.message}
                </p>
                <button
                  type="button"
                  onClick={() => refresh()}
                  className="mt-2 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-[var(--ink-1)]"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {brief ? (
              <>
                <section className="floating-subpanel mb-3 overflow-hidden px-3.5 py-3.5">
                  <div className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-semibold leading-snug text-[var(--ink-1)]">
                        {brief.headline}
                      </h3>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-2)]">
                        {brief.summary}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-[var(--ink-4)]">
                        <span className="rounded bg-white/5 px-1.5 py-0.5">
                          {brief.alertCount} alerts
                        </span>
                        <span className="rounded bg-white/5 px-1.5 py-0.5">
                          {brief.severeCount} severe-tier
                        </span>
                        <span className="rounded bg-white/5 px-1.5 py-0.5">
                          {brief.storms.length} tracked
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="mb-3">
                  <h4 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-4)]">
                    Threats
                  </h4>
                  <ul className="space-y-1.5">
                    {brief.threats.map((t) => (
                      <li
                        key={t}
                        className="flex gap-2 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2 text-[12px] text-[var(--ink-2)]"
                      >
                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-300" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="mb-3">
                  <h4 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-4)]">
                    What to do
                  </h4>
                  <ul className="space-y-1.5">
                    {brief.actions.map((a) => (
                      <li
                        key={a}
                        className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.04] px-3 py-2 text-[12px] text-[var(--ink-2)]"
                      >
                        {a}
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="mb-2">
                  <h4 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-4)]">
                    Tracked storms
                  </h4>
                  {brief.storms.length === 0 ? (
                    <p className="px-1 text-[12px] text-[var(--ink-3)]">
                      No tornado / severe / flood / tropical warnings to track
                      here.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {brief.storms.map((storm) => (
                        <button
                          key={storm.id}
                          type="button"
                          onClick={() => flyToStorm(storm.id)}
                          className="w-full rounded-2xl border border-white/5 bg-white/[0.035] px-3 py-3 text-left transition-colors hover:bg-white/[0.07]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold text-[var(--ink-1)]">
                              {storm.type}
                            </span>
                            <DangerBadge danger={storm.danger} />
                          </div>
                          {storm.area ? (
                            <div className="mt-1 flex items-start gap-1 text-[11px] text-[var(--ink-3)]">
                              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                              <span className="line-clamp-2">{storm.area}</span>
                            </div>
                          ) : null}
                          {storm.motionLabel ? (
                            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-cyan-200/80">
                              <Route className="h-3 w-3" />
                              {storm.motionLabel}
                            </div>
                          ) : null}
                          <div className="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--ink-4)]">
                            <Crosshair className="h-3 w-3" />
                            Open alert · focus on map
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <p className="px-1 pb-1 text-[10px] leading-relaxed text-[var(--ink-4)]">
                  {brief.disclaimer}
                </p>
              </>
            ) : null}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function DangerBadge({ danger }: { danger: StormDanger }) {
  const colors: Record<StormDanger, string> = {
    extreme: '#f43f5e',
    high: '#fb923c',
    moderate: '#facc15',
    low: '#38bdf8',
  };
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black"
      style={{ background: colors[danger] }}
    >
      {danger}
    </span>
  );
}
