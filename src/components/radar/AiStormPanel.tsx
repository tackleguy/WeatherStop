// Floating control for AI storm identification on the radar map.
// Toggles boxes / motion paths / severe + tornado markers.

import { Loader2, Sparkles, X } from 'lucide-react';
import { useStormAnalysis } from '../../hooks/useStormAnalysis';
import { useAlerts } from '../../hooks/useAlerts';
import { listStormCards, type StormFeatureProps } from '../../lib/stormAnalysis';
import { useRadarStore } from '../../store/useRadarStore';

function kindBadge(kind: StormFeatureProps['kind']): string {
  switch (kind) {
    case 'tornado':
      return 'Tornado';
    case 'severe':
      return 'Severe';
    case 'path':
      return 'Path';
    default:
      return 'Storm';
  }
}

export function AiStormPanel() {
  const active = useRadarStore((s) => s.aiStormsActive);
  const setActive = useRadarStore((s) => s.setAiStormsActive);
  const focusedStormId = useRadarStore((s) => s.focusedStormId);
  const focusStorm = useRadarStore((s) => s.focusStorm);
  const { alerts } = useAlerts();
  const { result, error, isLoading, refresh } = useStormAnalysis(alerts);
  const cards = listStormCards(result ?? null);

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="pointer-events-auto flex items-center gap-1 rounded-lg border border-[var(--line-default)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)] backdrop-blur-md hover:text-[var(--ink-1)]"
        style={{ background: 'var(--glass)' }}
        title="AI storm ID, paths, and tornado threats"
      >
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
        AI Storms
      </button>
    );
  }

  return (
    <div
      className="pointer-events-auto w-80 max-h-[min(52vh,420px)] overflow-hidden rounded-xl border border-[var(--line-default)] backdrop-blur-md"
      style={{ background: 'var(--glass-hi)' }}
    >
      <header className="flex items-center justify-between border-b border-[var(--line-subtle)] px-3 py-2">
        <div className="flex items-center gap-1.5 text-[var(--ink-2)]">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            AI Storms
          </span>
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-[var(--ink-3)]" />
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Close AI storms"
          onClick={() => setActive(false)}
          className="grid h-6 w-6 place-items-center rounded text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]"
        >
          <X className="h-3 w-3" strokeWidth={2.2} />
        </button>
      </header>

      <div className="space-y-2 overflow-y-auto px-3 py-3" style={{ maxHeight: 340 }}>
        {error ? (
          <p className="text-[12px] text-red-400">
            {error.message}. Is `npm run ai:server` running with Ollama/LM Studio?
          </p>
        ) : null}

        {result?.summary ? (
          <div className="rounded-lg border border-[var(--line-subtle)] px-2.5 py-2 text-[11px] text-[var(--ink-3)]">
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-semibold uppercase tracking-wider text-[var(--ink-2)]">
              <span>{result.summary.stormCount} storms</span>
              <span>{result.summary.tornadoThreats} tornado marks</span>
              <span>{result.summary.severeSpots} severe spots</span>
            </div>
            <p className="mt-1.5 leading-snug">{result.summary.note}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--ink-4)]">
              Source · {result.summary.source}
            </p>
          </div>
        ) : isLoading ? (
          <p className="text-[12px] text-[var(--ink-3)]">
            Identifying storms, drawing boxes, projecting paths…
          </p>
        ) : (
          <p className="text-[12px] text-[var(--ink-3)]">
            Waiting for map viewport…
          </p>
        )}

        {cards.length > 0 ? (
          <ul className="space-y-1.5">
            {cards.map((card) => {
              const focused = focusedStormId === card.stormId;
              return (
                <li key={card.stormId}>
                  <button
                    type="button"
                    onClick={() =>
                      focusStorm(focused ? null : card.stormId)
                    }
                    className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                      focused
                        ? 'border-[var(--accent)] bg-white/5'
                        : 'border-[var(--line-subtle)] hover:border-[var(--line-default)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-[var(--ink-1)]">
                        {card.label}
                      </span>
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                        style={{
                          background:
                            card.kind === 'tornado' || /tornado/i.test(card.event ?? '')
                              ? 'rgba(217,70,239,0.2)'
                              : 'rgba(245,158,11,0.2)',
                          color:
                            card.kind === 'tornado' || /tornado/i.test(card.event ?? '')
                              ? '#f0abfc'
                              : '#fcd34d',
                        }}
                      >
                        {kindBadge(
                          /tornado/i.test(card.event ?? '') ? 'tornado' : card.kind,
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-[var(--ink-3)]">
                      {card.detail}
                    </p>
                    <div className="mt-1 text-[10px] text-[var(--ink-4)]">
                      Confidence {(card.confidence * 100).toFixed(0)}%
                      {card.event ? ` · ${card.event}` : ''}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : result && !isLoading ? (
          <p className="text-[12px] text-[var(--ink-3)]">
            No severe / tornado cells identified here. Zoom into an active warning.
          </p>
        ) : null}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-[var(--line-subtle)] px-3 py-2">
        <button
          type="button"
          onClick={refresh}
          className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)] hover:text-[var(--ink-1)]"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => setActive(false)}
          className="rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-black"
          style={{ background: 'var(--accent)' }}
        >
          Done
        </button>
      </footer>
    </div>
  );
}
