import { AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { severityColor, severityRank, type NWSAlert } from '../hooks/useAlerts';

interface Props {
  alerts: NWSAlert[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (alert: NWSAlert) => void;
  onRefresh: () => void;
}

function formatTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AlertsInspector({
  alerts,
  loading,
  selectedId,
  onSelect,
  onRefresh,
}: Props) {
  const sorted = useMemo(
    () =>
      alerts
        .slice()
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity)),
    [alerts],
  );

  return (
    <aside className="glass flex h-full w-80 flex-col rounded-2xl">
      <header className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" strokeWidth={2.2} />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
            Active Alerts
          </h2>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh alerts"
          className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            strokeWidth={2.2}
          />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-2 no-scrollbar">
        {sorted.length === 0 ? (
          <div className="px-2 py-10 text-center text-sm text-white/55">
            {loading ? 'Loading…' : 'No active alerts.'}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {sorted.map((a) => (
              <AlertRow
                key={a.id}
                alert={a}
                active={selectedId === a.id}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-white/8 px-4 py-2 text-center text-[10px] text-white/45">
        {alerts.length} active · NWS
      </footer>
    </aside>
  );
}

function AlertRow({
  alert,
  active,
  onSelect,
}: {
  alert: NWSAlert;
  active: boolean;
  onSelect: (a: NWSAlert) => void;
}) {
  const [open, setOpen] = useState(false);
  const color = severityColor(alert.severity);
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onSelect(alert);
          setOpen(true);
        }}
        className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${
          active ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'
        }`}
      >
        <div className="flex items-start gap-2">
          <span
            className="mt-1 h-2 w-2 shrink-0 rounded-full"
            style={{ background: color }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-white">
                {alert.event}
              </span>
              <span
                className="text-[10px] font-medium uppercase tracking-wider"
                style={{ color }}
              >
                {alert.severity}
              </span>
            </div>
            <div className="truncate text-[11px] text-white/60">
              {alert.areaDesc}
            </div>
            <div className="mt-0.5 text-[10px] text-white/45">
              Until {formatTime(alert.expires)}
            </div>
          </div>
          <button
            type="button"
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/55 hover:bg-white/10 hover:text-white"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
              strokeWidth={2.4}
            />
          </button>
        </div>
        {open ? (
          <p className="mt-2 whitespace-pre-line text-[11px] text-white/75">
            {alert.headline}
            {alert.headline ? '\n\n' : ''}
            {alert.description}
          </p>
        ) : null}
      </button>
    </li>
  );
}
