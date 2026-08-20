// Full-page AI storm tracker — same brief as the radar panel, for deep focus.

import { BrainCircuit, Loader2, RefreshCw, Route, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStormBrief } from '../hooks/useStormBrief';
import { alertsPageHref } from '../lib/alertsNav';
import type { StormDanger } from '../lib/stormBrief';

export function StormView() {
  const { brief, loading, refreshing, error, refresh } = useStormBrief(true);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <header className="border-b border-[var(--line-subtle)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="mr-auto min-w-0">
            <p className="section-eyebrow">Storm Chaser</p>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--ink-1)]">
              <BrainCircuit className="h-5 w-5 text-cyan-300" />
              AI storm tracker
            </h1>
            <p className="mt-1 max-w-xl text-[13px] text-[var(--ink-3)]">
              On-device brief from NWS alerts for your map view. Optional local
              Ollama polish — open Radar and tap the radio icon for full Chase
              mode with Ask Local AI.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/radar" className="chip-button">
              Open radar
            </Link>
            <button
              type="button"
              onClick={() => refresh()}
              className="chip-button inline-flex items-center gap-1.5"
            >
              {refreshing || loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {loading && !brief ? (
          <div className="panel panel-padded text-sm text-[var(--ink-3)]">
            Building storm brief…
          </div>
        ) : null}
        {error && !brief ? (
          <div className="panel panel-padded">
            <p className="text-sm text-red-300">{error.message}</p>
          </div>
        ) : null}
        {brief ? (
          <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4">
              <section className="panel panel-padded">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                    {brief.source === 'nws+ai' ? 'NWS + AI' : 'NWS grounded'}
                  </span>
                  <span className="text-[11px] text-[var(--ink-4)]">
                    {brief.alertCount} alerts · {brief.storms.length} tracked
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-[var(--ink-1)]">
                  {brief.headline}
                </h2>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">
                  {brief.summary}
                </p>
              </section>

              <section className="panel panel-padded">
                <h3 className="card-label mb-3">Threats</h3>
                <ul className="space-y-2">
                  {brief.threats.map((t) => (
                    <li
                      key={t}
                      className="flex gap-2 text-[13px] text-[var(--ink-2)]"
                    >
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
                      {t}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="panel panel-padded">
                <h3 className="card-label mb-3">Actions</h3>
                <ul className="space-y-2 text-[13px] text-[var(--ink-2)]">
                  {brief.actions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <p className="mt-4 text-[11px] text-[var(--ink-4)]">
                  {brief.disclaimer}
                </p>
              </section>
            </div>

            <section className="panel panel-padded">
              <h3 className="card-label mb-3">Tracked storms</h3>
              {brief.storms.length === 0 ? (
                <p className="text-sm text-[var(--ink-3)]">
                  No severe convective warnings in this view.
                </p>
              ) : (
                <div className="space-y-2">
                  {brief.storms.map((storm) => (
                    <Link
                      key={storm.id}
                      to={alertsPageHref(storm.id)}
                      className="block rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3 transition-colors hover:bg-white/[0.06]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[var(--ink-1)]">
                          {storm.type}
                        </span>
                        <DangerBadge danger={storm.danger} />
                      </div>
                      {storm.area ? (
                        <p className="mt-1 line-clamp-2 text-[12px] text-[var(--ink-3)]">
                          {storm.area}
                        </p>
                      ) : null}
                      {storm.motionLabel ? (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-cyan-200/80">
                          <Route className="h-3 w-3" />
                          {storm.motionLabel}
                        </p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
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
