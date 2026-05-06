// Full NWS alert report. Headline, description, what-to-do instructions,
// severity/certainty/urgency badges, effective/expires times, polygon
// areas — everything `api.weather.gov/alerts/active` ships back. Used
// inside AlertsPanel as a "drill-in" detail view, and standalone in the
// home AlertsBanner expansion.

import {
  ArrowLeft,
  ChevronRight,
  Clock,
  MapPin,
  X,
} from 'lucide-react';
import { severityColor } from '../../lib/colorTables';
import type { AlertRow } from '../../lib/nwsAlerts';

interface Props {
  alert: AlertRow;
  /** Optional back / close handler. When provided, renders the back arrow
   *  in the header. Pass `null` for a flat (no-back) presentation. */
  onBack?: (() => void) | null;
  /** Optional close handler — renders an X button in the header. */
  onClose?: (() => void) | null;
  /** "Show on map" → caller flies the map to the alert and dismisses
   *  whatever sheet is showing. Optional. */
  onLocate?: (() => void) | null;
}

function formatAbsolute(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function severityLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AlertDetail({ alert, onBack, onClose, onLocate }: Props) {
  const areas = alert.areaDesc
    .split(';')
    .map((a) => a.trim())
    .filter(Boolean);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-[var(--line-subtle)] px-4 py-2.5">
        {onBack ? (
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="grid h-7 w-7 place-items-center rounded text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          </button>
        ) : null}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: severityColor(alert.severity) }}
          />
          <span className="truncate text-[13px] font-semibold uppercase tracking-wider text-white">
            {alert.event}
          </span>
        </div>
        {onClose ? (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        ) : null}
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 text-[13px] leading-relaxed text-white/85">
        {/* Severity / certainty / urgency badges */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Badge label={severityLabel(alert.severity)} color={severityColor(alert.severity)} />
          {alert.certainty ? (
            <Badge label={alert.certainty} color="rgba(148,163,184,0.75)" />
          ) : null}
          {alert.urgency ? (
            <Badge label={alert.urgency} color="rgba(148,163,184,0.6)" />
          ) : null}
        </div>

        {/* Time window */}
        <section className="mb-4 grid grid-cols-2 gap-3 rounded-md border border-white/8 bg-white/3 px-3 py-2">
          <TimeRow icon={<Clock className="h-3 w-3" strokeWidth={2.2} />} label="Effective" value={formatAbsolute(alert.effective)} />
          <TimeRow icon={<Clock className="h-3 w-3" strokeWidth={2.2} />} label="Expires" value={formatAbsolute(alert.expires)} relative={alert.expiresRelative} />
        </section>

        {/* Headline */}
        {alert.headline ? (
          <h3 className="mb-3 text-[14px] font-semibold leading-snug text-white">
            {alert.headline}
          </h3>
        ) : null}

        {/* Description */}
        {alert.description ? (
          <p className="mb-4 whitespace-pre-line text-white/85">
            {alert.description.trim()}
          </p>
        ) : null}

        {/* What-to-do instruction (NWS sometimes embeds it inside `description`,
            so we use this only when the upstream supplied a separate field —
            today the parsed AlertRow doesn't break it out, so the description
            block above usually carries everything). */}

        {/* Affected areas */}
        {areas.length > 0 ? (
          <section className="mt-4">
            <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/55">
              <MapPin className="h-2.5 w-2.5" strokeWidth={2.4} />
              Affected areas
            </div>
            <ul className="text-[12px] text-white/75 space-y-0.5">
              {areas.map((area) => (
                <li key={area} className="flex gap-1">
                  <ChevronRight className="mt-0.5 h-2.5 w-2.5 shrink-0 text-white/45" strokeWidth={2.4} />
                  {area}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {onLocate ? (
        <footer className="border-t border-[var(--line-subtle)] px-4 py-2.5">
          <button
            type="button"
            onClick={onLocate}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--accent,#ff8a3d)] px-3 py-2 text-[12px] font-semibold uppercase tracking-wider text-black hover:opacity-90"
          >
            <MapPin className="h-3.5 w-3.5" strokeWidth={2.4} />
            Show on map
          </button>
        </footer>
      ) : null}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
      style={{ borderColor: color, background: `${color}22`, color }}
    >
      {label}
    </span>
  );
}

function TimeRow({
  icon,
  label,
  value,
  relative,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  relative?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/55">
        {icon}
        {label}
      </div>
      <div data-num className="mt-0.5 text-[11px] text-white/85">
        {value}
      </div>
      {relative ? (
        <div className="text-[10px] text-white/55">{relative}</div>
      ) : null}
    </div>
  );
}
