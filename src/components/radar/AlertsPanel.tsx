import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, Route, Tornado, X } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlerts } from '../../hooks/useAlerts';
import { useTropical } from '../../hooks/useTropical';
import {
  categorizeAlertEvent,
  useRadarStore,
} from '../../store/useRadarStore';
import { severityColor } from '../../lib/colorTables';
import { alertsPageHref } from '../../lib/alertsNav';
import { alertStorms, type StormDanger } from '../../lib/stormIntelligence';
import { AlertDetail } from './AlertDetail';

export function AlertsPanel() {
  const navigate = useNavigate();
  const open = useRadarStore((s) => s.panelsOpen.alerts);
  const togglePanel = useRadarStore((s) => s.togglePanel);
  const focusedAlertId = useRadarStore((s) => s.focusedAlertId);
  const focusAlert = useRadarStore((s) => s.focusAlert);
  const filter = useRadarStore((s) => s.alertFilter);
  const { alerts: rawAlerts, loading } = useAlerts();
  const { geojson: tropicalPoints } = useTropical('points', 'all');
  const identifiedStorms = useMemo(() => alertStorms(rawAlerts), [rawAlerts]);
  const tropicalSystems = useMemo(
    () => {
      const systems = new Map<
        string,
        { id: string; name: string; classification: string; wind: number }
      >();
      tropicalPoints.features.forEach((feature, index) => {
        const p = (feature.properties ?? {}) as Record<string, unknown>;
        const name = String(
          p.STORMNAME ?? p.stormname ?? p.NAME ?? p.name ?? p.label ?? 'Tropical system',
        );
        const classification = String(
          p.STORMTYPE ?? p.stormtype ?? p.TCDVLP ?? p.type ?? 'NHC forecast system',
        );
        const wind = Number(
          p.MAXWIND ?? p.maxwind ?? p.INTENSITY ?? p.wind ?? Number.NaN,
        );
        const key = name.toUpperCase();
        const existing = systems.get(key);
        const next = {
          id: String(p.ADVISNUM ?? p.idp_source ?? `${name}-${index}`),
          name,
          classification,
          wind,
        };
        if (!existing || (!Number.isFinite(existing.wind) && Number.isFinite(wind))) {
          systems.set(key, next);
        }
      });
      return Array.from(systems.values()).slice(0, 8);
    },
    [tropicalPoints],
  );

  const alerts = useMemo(
    () =>
      filter.size === 0
        ? rawAlerts
        : rawAlerts.filter((a) => filter.has(categorizeAlertEvent(a.event))),
    [rawAlerts, filter],
  );

  const focused = focusedAlertId
    ? alerts.find((a) => a.id === focusedAlertId) ??
      rawAlerts.find((a) => a.id === focusedAlertId)
    : null;

  const openAlert = (id: string) => {
    focusAlert(id);
    navigate(alertsPageHref(id));
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="alerts"
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="absolute bottom-0 right-0 top-0 z-10 flex w-[380px] max-w-[calc(100vw-1rem)] flex-col border-l border-[var(--line-default)] backdrop-blur-[28px]"
          style={{
            background: 'linear-gradient(180deg, rgba(12,18,30,0.96), rgba(10,15,26,0.92))',
          }}
        >
          {focused ? (
            <AlertDetail
              alert={focused}
              onBack={() => focusAlert(null)}
              onClose={() => {
                focusAlert(null);
                togglePanel('alerts');
              }}
              onLocate={null}
            />
          ) : (
            <>
              <header className="border-b border-[var(--line-subtle)] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="section-eyebrow">Storm intelligence</p>
                    <div className="mt-1 flex items-center gap-2">
                      <AlertTriangle
                        className="h-4 w-4"
                        strokeWidth={2}
                        style={{ color: 'var(--sev-severe)' }}
                      />
                      <h2 className="text-[15px] font-semibold text-[var(--ink-1)]">
                        Active alerts
                      </h2>
                      <span data-num className="text-[12px] text-[var(--ink-3)]">
                        {alerts.length}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--ink-3)]">
                      Official warnings, local storm signals, and quick drill-in.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => togglePanel('alerts')}
                    className="control-button h-10 w-10 shrink-0"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                <section className="floating-subpanel mb-3 overflow-hidden">
                  <div className="flex items-center justify-between px-4 pb-2 pt-3">
                    <div className="flex items-center gap-2">
                      <Tornado className="h-4 w-4 text-cyan-300" />
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                        Priority signals
                      </h3>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider text-[var(--ink-4)]">
                      Local + official
                    </span>
                  </div>
                  {identifiedStorms.length === 0 && tropicalSystems.length === 0 ? (
                    <p className="px-4 pb-4 text-[12px] leading-relaxed text-[var(--ink-3)]">
                      No severe storm signatures confirmed in this view.
                    </p>
                  ) : (
                    <div className="space-y-2 px-3 pb-3">
                      {identifiedStorms.slice(0, 6).map((storm) => (
                        <button
                          key={storm.id}
                          type="button"
                          onClick={() => openAlert(storm.id)}
                          className="w-full rounded-2xl border border-white/5 bg-white/[0.035] px-3 py-3 text-left transition-colors hover:bg-white/[0.07]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold text-[var(--ink-1)]">
                              {storm.type}
                            </span>
                            <DangerBadge danger={storm.danger} />
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--ink-3)]">
                            <Route className="h-3 w-3" />
                            {storm.description}
                          </div>
                          <div className="mt-2 text-[10px] uppercase tracking-wider text-[var(--ink-4)]">
                            NWS-confirmed · circle + 60 min path
                          </div>
                        </button>
                      ))}
                      {tropicalSystems.map((storm) => (
                        <div
                          key={storm.id}
                          className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold text-[var(--ink-1)]">
                              {storm.name}
                            </span>
                            <DangerBadge
                              danger={
                                Number.isFinite(storm.wind) && storm.wind >= 74
                                  ? 'high'
                                  : 'moderate'
                              }
                            />
                          </div>
                          <div className="mt-1 text-[11px] text-[var(--ink-3)]">
                            {storm.classification}
                            {Number.isFinite(storm.wind)
                              ? ` · ${Math.round(storm.wind)} kt`
                              : ''}
                          </div>
                          <div className="mt-2 text-[10px] uppercase tracking-wider text-cyan-200/60">
                            Official NHC forecast track
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                {loading && alerts.length === 0 ? (
                  <div className="floating-subpanel p-4 text-sm text-[var(--ink-3)]">
                    Loading alerts…
                  </div>
                ) : null}
                {!loading && alerts.length === 0 ? (
                  <div className="floating-subpanel p-8 text-center">
                    <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-[var(--ink-4)]" />
                    <p className="text-sm text-[var(--ink-3)]">
                      No active alerts
                    </p>
                  </div>
                ) : null}
                <div className="space-y-2">
                  {alerts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => openAlert(a.id)}
                      className="floating-subpanel flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                    >
                      <div
                        className="mt-0.5 w-1.5 self-stretch rounded-full"
                        style={{ background: severityColor(a.severity) }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold leading-snug text-[var(--ink-1)]">
                          {a.event}
                        </div>
                        <div className="mt-1 line-clamp-2 text-[11px] text-[var(--ink-3)]">
                          {a.areaDesc}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider">
                          <span className="text-[var(--ink-4)]">
                            Expires {a.expiresRelative}
                          </span>
                          <span className="text-[var(--ink-3)]">Open details</span>
                        </div>
                      </div>
                      <ChevronRight
                        className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--ink-4)]"
                        strokeWidth={2}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
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
