// Full-page NWS alerts — list + detail split matching the UI board.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAlerts } from '../hooks/useAlerts';
import type { AlertRow } from '../lib/nwsAlerts';

type Filter = 'all' | 'severe' | 'moderate' | 'minor';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'severe', label: 'Severe' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'minor', label: 'Advisory' },
];

function sevColor(s: AlertRow['severity']): string {
  if (s === 'extreme') return 'var(--sev-extreme)';
  if (s === 'severe') return 'var(--sev-severe)';
  if (s === 'moderate') return 'var(--sev-moderate)';
  if (s === 'minor') return 'var(--sev-minor)';
  return 'var(--sev-unknown)';
}

export function AlertsView() {
  const { alerts, loading, error, refresh } = useAlerts();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return alerts;
    if (filter === 'severe')
      return alerts.filter(
        (a) => a.severity === 'severe' || a.severity === 'extreme',
      );
    return alerts.filter((a) => a.severity === filter);
  }, [alerts, filter]);

  const selected =
    filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-[var(--line-subtle)] px-4 py-3 sm:px-5">
        <div className="mr-auto">
          <p className="card-label">Alerts</p>
          <h1 className="text-xl font-semibold text-[var(--ink-1)]">
            Active warnings
            <span className="ml-2 text-[13px] font-normal text-[var(--ink-4)]">
              {alerts.length}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                filter === f.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--ink-3)] hover:bg-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Link
          to="/outlooks"
          className="rounded-full border border-[var(--line-default)] px-3 py-1.5 text-[12px] text-[var(--ink-2)]"
        >
          SPC Outlooks
        </Link>
        <button
          type="button"
          onClick={refresh}
          className="rounded-full px-3 py-1.5 text-[12px] text-[var(--ink-3)] hover:bg-white/5"
        >
          Refresh
        </button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_1fr]">
        <aside className="overflow-y-auto border-r border-[var(--line-subtle)]">
          {loading && alerts.length === 0 ? (
            <p className="p-4 text-[13px] text-[var(--ink-4)]">Loading…</p>
          ) : error && alerts.length === 0 ? (
            <p className="p-4 text-[13px] text-[var(--ink-3)]">
              Alerts unavailable in this environment. Try{' '}
              <code className="text-[var(--accent-2)]">vercel dev</code>.
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-[13px] text-[var(--ink-4)]">No alerts.</p>
          ) : (
            <ul>
              {filtered.map((a) => {
                const active = selected?.id === a.id;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className={`flex w-full flex-col gap-1 border-b border-[var(--line-subtle)] px-4 py-3 text-left transition-colors ${
                        active ? 'bg-white/8' : 'hover:bg-white/4'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: sevColor(a.severity) }}
                        />
                        <span className="text-[13px] font-semibold text-[var(--ink-1)]">
                          {a.event}
                        </span>
                      </span>
                      <span className="line-clamp-1 text-[11px] text-[var(--ink-4)]">
                        {a.areaDesc}
                      </span>
                      <span className="text-[11px] text-[var(--ink-3)]">
                        Expires {a.expiresRelative}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <main className="overflow-y-auto p-4 sm:p-6">
          {selected ? (
            <article className="panel panel-padded mx-auto max-w-3xl">
              <div className="mb-3 flex items-start gap-3">
                <span
                  className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ background: sevColor(selected.severity) }}
                />
                <div>
                  <h2 className="text-xl font-semibold text-[var(--ink-1)]">
                    {selected.event}
                  </h2>
                  <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                    {selected.areaDesc}
                  </p>
                </div>
              </div>
              <dl className="mb-4 grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-3">
                <div>
                  <dt className="text-[var(--ink-4)]">Severity</dt>
                  <dd className="font-semibold capitalize text-[var(--ink-1)]">
                    {selected.severity}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--ink-4)]">Urgency</dt>
                  <dd className="font-semibold text-[var(--ink-1)]">
                    {selected.urgency || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--ink-4)]">Expires</dt>
                  <dd className="font-semibold text-[var(--ink-1)]">
                    {selected.expiresRelative}
                  </dd>
                </div>
              </dl>
              {selected.headline ? (
                <p className="mb-3 text-[14px] font-medium text-[var(--ink-2)]">
                  {selected.headline}
                </p>
              ) : null}
              <h3 className="card-label mb-2">Discussion</h3>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ink-3)]">
                {selected.description || 'No additional details.'}
              </p>
              <Link
                to="/radar"
                className="mt-5 inline-flex rounded-full bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-white"
              >
                View on Radar
              </Link>
            </article>
          ) : (
            <p className="text-[13px] text-[var(--ink-4)]">
              Select an alert to read the discussion.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
