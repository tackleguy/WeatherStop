// Full-page NWS alerts — list + detail split matching the UI board.

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAlerts } from '../hooks/useAlerts';
import type { AlertRow } from '../lib/nwsAlerts';
import { useRadarStore } from '../store/useRadarStore';

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
  const [searchParams] = useSearchParams();
  const focusFromUrl = searchParams.get('id');
  const [selectedId, setSelectedId] = useState<string | null>(focusFromUrl);
  const focusAlert = useRadarStore((s) => s.focusAlert);

  useEffect(() => {
    if (focusFromUrl) setSelectedId(focusFromUrl);
  }, [focusFromUrl]);

  const filtered = useMemo(() => {
    if (filter === 'all') return alerts;
    if (filter === 'severe')
      return alerts.filter(
        (a) => a.severity === 'severe' || a.severity === 'extreme',
      );
    return alerts.filter((a) => a.severity === filter);
  }, [alerts, filter]);

  // Prefer the deep-linked id even if the current severity filter would hide it.
  const selected =
    (selectedId
      ? alerts.find((a) => a.id === selectedId) ??
        filtered.find((a) => a.id === selectedId)
      : null) ??
    filtered[0] ??
    null;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <header className="border-b border-[var(--line-subtle)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="mr-auto min-w-0">
            <p className="section-eyebrow">Alerts</p>
            <h1 className="text-xl font-semibold text-[var(--ink-1)]">
              Active warnings
              <span className="ml-2 text-[13px] font-normal text-[var(--ink-4)]">
                {alerts.length}
              </span>
            </h1>
            <p className="mt-1 text-[13px] text-[var(--ink-3)]">
              Official alert text preserved with faster scanning and cleaner detail hierarchy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className="chip-button"
                data-active={filter === f.id}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/outlooks" className="chip-button">
              SPC Outlooks
            </Link>
            <button type="button" onClick={refresh} className="chip-button">
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_1fr]">
        <aside className="overflow-y-auto border-r border-[var(--line-subtle)] p-3">
          {loading && alerts.length === 0 ? (
            <div className="floating-subpanel p-4 text-[13px] text-[var(--ink-4)]">
              Loading alerts…
            </div>
          ) : error && alerts.length === 0 ? (
            <div className="floating-subpanel p-4 text-[13px] text-[var(--ink-3)]">
              Alerts unavailable in this environment. Try{' '}
              <code className="text-[var(--accent-2)]">vercel dev</code>.
            </div>
          ) : filtered.length === 0 ? (
            <div className="floating-subpanel p-4 text-[13px] text-[var(--ink-4)]">
              No alerts.
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((a) => {
                const active = selected?.id === a.id;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className={`floating-subpanel flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors ${
                        active
                          ? 'border-[color:color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[var(--accent-soft)]'
                          : 'hover:bg-white/4'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: sevColor(a.severity) }}
                        />
                        <span className="text-[13px] font-semibold text-[var(--ink-1)]">
                          {a.event}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-[11px] text-[var(--ink-3)]">
                        {a.areaDesc}
                      </span>
                      <span className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider">
                        <span className="text-[var(--ink-4)]">
                          Expires {a.expiresRelative}
                        </span>
                        {active ? (
                          <span className="text-[var(--accent-2)]">Selected</span>
                        ) : null}
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
            <article className="panel panel-padded mx-auto max-w-4xl">
              <div className="mb-4 flex flex-wrap items-start gap-3">
                <span
                  className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ background: sevColor(selected.severity) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="section-eyebrow">Selected alert</p>
                  <h2 className="mt-1 text-2xl font-semibold text-[var(--ink-1)]">
                    {selected.event}
                  </h2>
                  <p className="mt-1 text-[14px] text-[var(--ink-3)]">
                    {selected.areaDesc}
                  </p>
                </div>
                <Link
                  to="/radar"
                  onClick={() => {
                    if (selected) focusAlert(selected.id);
                  }}
                  className="chip-button"
                  data-active="true"
                >
                  View on Radar
                </Link>
              </div>
              <dl className="mb-5 grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-3">
                <div className="floating-subpanel px-3 py-3">
                  <dt className="section-eyebrow">Severity</dt>
                  <dd className="mt-1 font-semibold capitalize text-[var(--ink-1)]">
                    {selected.severity}
                  </dd>
                </div>
                <div className="floating-subpanel px-3 py-3">
                  <dt className="section-eyebrow">Urgency</dt>
                  <dd className="mt-1 font-semibold text-[var(--ink-1)]">
                    {selected.urgency || '—'}
                  </dd>
                </div>
                <div className="floating-subpanel px-3 py-3">
                  <dt className="section-eyebrow">Expires</dt>
                  <dd className="mt-1 font-semibold text-[var(--ink-1)]">
                    {selected.expiresRelative}
                  </dd>
                </div>
              </dl>
              {selected.headline ? (
                <p className="mb-4 text-[15px] font-medium leading-relaxed text-[var(--ink-2)]">
                  {selected.headline}
                </p>
              ) : null}
              <div className="floating-subpanel px-4 py-4">
                <h3 className="section-eyebrow mb-2">Discussion</h3>
                <p className="whitespace-pre-wrap text-[13px] leading-7 text-[var(--ink-3)]">
                  {selected.description || 'No additional details.'}
                </p>
              </div>
            </article>
          ) : (
            <div className="floating-subpanel p-6 text-[13px] text-[var(--ink-4)]">
              Select an alert to read the discussion.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
