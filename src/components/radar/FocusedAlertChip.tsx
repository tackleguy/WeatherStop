// Floating "Clear focus" chip shown on the radar map whenever an alert
// is focused. Tapping it (or pressing Esc, see RadarView) drops the
// highlight + filter and returns the user to the unfocused view.

import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useAlerts } from '../../hooks/useAlerts';
import { severityColor } from '../../lib/colorTables';
import { useRadarStore } from '../../store/useRadarStore';

export function FocusedAlertChip() {
  const focusedAlertId = useRadarStore((s) => s.focusedAlertId);
  const focusAlert = useRadarStore((s) => s.focusAlert);
  const { alerts } = useAlerts();

  // Esc clears the focus globally — works whether the panel is open
  // or the map has focus.
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
    <button
      type="button"
      onClick={() => focusAlert(null)}
      title="Clear focus (Esc)"
      className="pointer-events-auto absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--line-default)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-md transition-colors hover:bg-white/10"
      style={{ background: 'var(--glass-hi)' }}
    >
      <span
        className="h-2 w-2 rounded-full animate-alert-pulse"
        style={{ background: severityColor(focused.severity) }}
      />
      <span className="max-w-[260px] truncate normal-case tracking-normal">
        Tracking · {focused.event}
      </span>
      <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-white/70">
        <X className="h-3 w-3" strokeWidth={2.4} />
      </span>
    </button>
  );
}
