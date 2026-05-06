import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WeatherAlert } from '../types';

interface Props {
  alerts: WeatherAlert[];
}

const SEVERE = new Set(['Severe', 'Extreme']);
const DISMISS_KEY = 'home-alert-dismissed-v1';

function loadDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function formatAbsolute(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AlertsBanner({ alerts }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [expanded, setExpanded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const severe = useMemo(
    () =>
      alerts
        .filter((a) => SEVERE.has(a.severity))
        .filter((a) => !dismissed.has(a.id)),
    [alerts, dismissed],
  );

  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId]);

  if (severe.length === 0) return null;

  const primary = severe[0];
  const active = activeId ? severe.find((a) => a.id === activeId) : null;

  const dismissAlert = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    saveDismissed(next);
    setDismissed(next);
    if (activeId === id) setActiveId(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-red-400/40 bg-red-500/25 px-4 py-3 backdrop-blur-xl"
    >
      {/* Collapsed header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-red-100"
            strokeWidth={2.4}
          />
          <div className="flex-1 min-w-0">
            <div className="truncate text-[13px] font-semibold text-white">
              {primary.event}
              {severe.length > 1 ? ` · +${severe.length - 1} more` : ''}
            </div>
            <div className="line-clamp-1 text-[12px] text-red-50/85">
              {primary.headline}
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-red-100 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
            strokeWidth={2.2}
          />
        </button>
        <button
          type="button"
          aria-label="Dismiss banner"
          title="Dismiss this alert"
          onClick={() => dismissAlert(primary.id)}
          className="ml-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-red-50/75 hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      </div>

      {/* Expanded: full list */}
      <AnimatePresence initial={false}>
        {expanded && !active ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <ul className="mt-3 space-y-2">
              {severe.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-red-300/25 bg-red-500/15 p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-white">
                        {a.event}
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-[11px] text-red-100/80">
                        {a.areaDesc}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-red-100/60">
                        Until {formatAbsolute(a.expires)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveId(a.id)}
                        className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-white/20"
                      >
                        Read
                      </button>
                      <button
                        type="button"
                        aria-label={`Dismiss ${a.event}`}
                        onClick={() => dismissAlert(a.id)}
                        className="grid h-6 w-6 place-items-center rounded-full text-red-50/65 hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-3 w-3" strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}

        {/* Drilled-in detail */}
        {active ? (
          <motion.div
            key={`detail-${active.id}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-lg border border-red-300/25 bg-red-500/15 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-red-100/85 hover:text-white"
                >
                  <ChevronUp className="h-3 w-3" strokeWidth={2.4} />
                  Back to list
                </button>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => dismissAlert(active.id)}
                  className="grid h-6 w-6 place-items-center rounded-full text-red-50/75 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.4} />
                </button>
              </div>
              <div className="text-[14px] font-semibold text-white">{active.event}</div>
              <div className="mt-0.5 text-[11px] text-red-100/80">
                {active.areaDesc}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-red-100/65">
                Effective {formatAbsolute(active.effective)} · Until{' '}
                {formatAbsolute(active.expires)}
              </div>
              {active.headline ? (
                <p className="mt-2 text-[13px] font-medium text-white/95">
                  {active.headline}
                </p>
              ) : null}
              {active.description ? (
                <p className="mt-2 whitespace-pre-line text-[13px] text-red-50/90">
                  {active.description.trim()}
                </p>
              ) : null}
              <Link
                to="/radar"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-red-700 hover:bg-white/90"
              >
                <ExternalLink className="h-3 w-3" strokeWidth={2.4} />
                Open in radar
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
