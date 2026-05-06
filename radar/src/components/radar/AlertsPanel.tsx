import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useMemo } from 'react';
import { useAlerts } from '../../hooks/useAlerts';
import {
  categorizeAlertEvent,
  useRadarStore,
} from '../../store/useRadarStore';
import { severityColor } from '../../lib/colorTables';

export function AlertsPanel() {
  const open = useRadarStore((s) => s.panelsOpen.alerts);
  const togglePanel = useRadarStore((s) => s.togglePanel);
  const focusedAlertId = useRadarStore((s) => s.focusedAlertId);
  const focusAlert = useRadarStore((s) => s.focusAlert);
  const filter = useRadarStore((s) => s.alertFilter);
  const { alerts: rawAlerts, loading } = useAlerts();

  const alerts = useMemo(
    () =>
      filter.size === 0
        ? rawAlerts
        : rawAlerts.filter((a) => filter.has(categorizeAlertEvent(a.event))),
    [rawAlerts, filter],
  );

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="alerts"
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="absolute bottom-0 right-0 top-0 z-10 flex w-[320px] flex-col border-l border-[var(--line-default)] backdrop-blur-[28px]"
          style={{ background: 'var(--glass-hi)' }}
        >
          <header className="flex h-12 items-center justify-between border-b border-[var(--line-subtle)] px-4">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className="h-4 w-4"
                strokeWidth={2}
                style={{ color: 'var(--sev-severe)' }}
              />
              <h2 className="text-[13px] font-semibold uppercase tracking-wider">
                Active Alerts
              </h2>
              <span
                data-num
                className="text-[11px] text-[var(--ink-3)]"
              >
                {alerts.length}
              </span>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => togglePanel('alerts')}
              className="rounded p-1 text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            {loading && alerts.length === 0 ? (
              <div className="p-4 text-sm text-[var(--ink-3)]">
                Loading alerts…
              </div>
            ) : null}
            {!loading && alerts.length === 0 ? (
              <div className="p-8 text-center">
                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-[var(--ink-4)]" />
                <p className="text-sm text-[var(--ink-3)]">No active alerts</p>
              </div>
            ) : null}
            {alerts.map((a) => {
              const active = a.id === focusedAlertId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => focusAlert(a.id)}
                  className={`w-full border-b border-[var(--line-subtle)] px-4 py-3 text-left transition-colors hover:bg-white/5 ${
                    active ? 'bg-white/8' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 w-1 self-stretch rounded-full"
                      style={{ background: severityColor(a.severity) }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold leading-snug">
                        {a.event}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[11px] text-[var(--ink-3)]">
                        {a.areaDesc}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--ink-4)]">
                        Expires {a.expiresRelative}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
