// Floating chip when an alert is focused on the radar map.

import { ExternalLink, X } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAlerts } from '../../hooks/useAlerts';
import { severityColor } from '../../lib/colorTables';
import { alertsPageHref } from '../../lib/alertsNav';
import { useRadarStore } from '../../store/useRadarStore';

export function FocusedAlertChip() {
  const focusedAlertId = useRadarStore((s) => s.focusedAlertId);
  const focusAlert = useRadarStore((s) => s.focusAlert);
  const { alerts } = useAlerts();

  useEffect(() => {
    if (!focusedAlertId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') focusAlert(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedAlertId, focusAlert]);

  if (!focusedAlertId) return null;
  const focused = alerts.find((a) => a.id === focusedAlertId);
  if (!focused) return null;

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--line-default)] px-1.5 py-1 backdrop-blur-md"
      style={{ background: 'var(--glass-hi)' }}
    >
      <Link
        to={alertsPageHref(focused.id)}
        className="flex max-w-[280px] items-center gap-2 rounded-full px-2 py-1 text-[11px] font-semibold text-[var(--ink-1)] transition-colors hover:bg-[var(--hover-fill)]"
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full animate-alert-pulse"
          style={{ background: severityColor(focused.severity) }}
        />
        <span className="truncate normal-case tracking-normal">
          {focused.event}
        </span>
        <ExternalLink
          className="h-3 w-3 shrink-0 text-[var(--ink-3)]"
          strokeWidth={2}
        />
      </Link>
      <button
        type="button"
        onClick={() => focusAlert(null)}
        title="Clear focus (Esc)"
        className="grid h-6 w-6 place-items-center rounded-full text-[var(--ink-3)] hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]"
      >
        <X className="h-3 w-3" strokeWidth={2.2} />
      </button>
    </div>
  );
}
