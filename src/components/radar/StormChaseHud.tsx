// Storm chase mode HUD — local brief + optional Ollama ask box.

import {
  BrainCircuit,
  Crosshair,
  Loader2,
  Navigation,
  Radio,
  Send,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlerts } from '../../hooks/useAlerts';
import { useSettings } from '../../hooks/useSettings';
import { alertsPageHref } from '../../lib/alertsNav';
import {
  askLocalChaseAi,
  DEFAULT_LOCAL_AI,
  polishBriefWithLocalAi,
  probeLocalAi,
} from '../../lib/localAi';
import {
  composeLocalChaseBrief,
  type ChaseBrief,
} from '../../lib/stormChaseBrief';
import { useRadarStore } from '../../store/useRadarStore';

function compass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
}

export function StormChaseHud() {
  const chaseMode = useRadarStore((s) => s.chaseMode);
  const setChaseMode = useRadarStore((s) => s.setChaseMode);
  const mapCenter = useRadarStore((s) => s.mapCenter);
  const focusAlert = useRadarStore((s) => s.focusAlert);
  const navigate = useNavigate();
  const { alerts } = useAlerts();
  const { settings } = useSettings();

  const localAi = {
    enabled: settings.localAiEnabled ?? DEFAULT_LOCAL_AI.enabled,
    url: settings.localAiUrl || DEFAULT_LOCAL_AI.url,
    model: settings.localAiModel || DEFAULT_LOCAL_AI.model,
  };

  const baseBrief = useMemo(
    () =>
      composeLocalChaseBrief(alerts, {
        center: mapCenter,
        placeLabel: mapCenter
          ? `${mapCenter[1].toFixed(2)}°, ${mapCenter[0].toFixed(2)}°`
          : 'map center',
      }),
    [alerts, mapCenter],
  );

  const [brief, setBrief] = useState<ChaseBrief>(baseBrief);
  const [polishing, setPolishing] = useState(false);
  const [aiStatus, setAiStatus] = useState('Checking local AI…');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    setBrief(baseBrief);
  }, [baseBrief]);

  useEffect(() => {
    if (!chaseMode) return;
    const ac = new AbortController();
    probeLocalAi(localAi, ac.signal).then((r) => {
      if (ac.signal.aborted) return;
      setAiStatus(r.ok ? r.detail : r.detail);
    });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaseMode, localAi.enabled, localAi.url, localAi.model]);

  useEffect(() => {
    if (!chaseMode || !localAi.enabled) return;
    const ac = new AbortController();
    setPolishing(true);
    polishBriefWithLocalAi(baseBrief, localAi, ac.signal)
      .then((next) => {
        if (!ac.signal.aborted) setBrief(next);
      })
      .catch(() => {
        // Keep on-device brief — Ollama optional.
      })
      .finally(() => {
        if (!ac.signal.aborted) setPolishing(false);
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaseMode, baseBrief.generatedAt, localAi.enabled, localAi.model, localAi.url]);

  if (!chaseMode) return null;

  const ask = async () => {
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    setAskError(null);
    setAnswer(null);
    try {
      const text = await askLocalChaseAi(q, brief, localAi);
      setAnswer(text);
    } catch (err) {
      setAskError(err instanceof Error ? err.message : 'Local AI failed');
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="pointer-events-auto absolute left-3 right-3 top-16 z-30 mx-auto w-full max-w-lg md:left-4 md:right-auto md:top-[4.5rem]">
      <div
        className="overflow-hidden rounded-3xl border border-cyan-300/20 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-[28px]"
        style={{
          background:
            'linear-gradient(160deg, rgba(8,28,36,0.96), rgba(10,16,28,0.94))',
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/5 px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Radio className="h-4 w-4 shrink-0 text-cyan-300" />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">
                Storm chase mode
              </div>
              <div className="truncate text-[10px] text-[var(--ink-4)]">
                {polishing ? 'Local AI polishing…' : aiStatus}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setChaseMode(false)}
            className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-2)] hover:bg-white/15"
          >
            Exit
          </button>
        </div>

        <div className="space-y-3 px-3.5 py-3">
          <div>
            <div className="flex items-start gap-2">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div>
                <h3 className="text-[14px] font-semibold leading-snug text-[var(--ink-1)]">
                  {brief.headline}
                </h3>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-2)]">
                  {brief.summary}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[9px] uppercase tracking-wider text-[var(--ink-4)]">
                  <span className="rounded bg-white/5 px-1.5 py-0.5">
                    {brief.source === 'local+ollama' ? 'Local AI' : 'On-device'}
                  </span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5">
                    {brief.storms.length} tracked
                  </span>
                </div>
              </div>
            </div>
          </div>

          {brief.nearest ? (
            <button
              type="button"
              onClick={() => {
                focusAlert(brief.nearest!.id);
                navigate(alertsPageHref(brief.nearest!.id));
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-orange-300/20 bg-orange-400/[0.07] px-3 py-2.5 text-left"
            >
              <Navigation className="h-4 w-4 shrink-0 text-orange-300" />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-[var(--ink-1)]">
                  Nearest · {brief.nearest.type}
                </div>
                <div className="text-[11px] text-[var(--ink-3)]">
                  {brief.nearest.distanceMi} mi{' '}
                  {compass(brief.nearest.bearingDeg ?? 0)}
                  {brief.nearest.etaMin != null
                    ? ` · ~${brief.nearest.etaMin} min if closing`
                    : ''}
                </div>
              </div>
              <Crosshair className="h-3.5 w-3.5 text-[var(--ink-4)]" />
            </button>
          ) : null}

          <ul className="space-y-1">
            {brief.threats.slice(0, 3).map((t) => (
              <li
                key={t}
                className="flex gap-2 text-[11px] leading-snug text-[var(--ink-2)]"
              >
                <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-orange-300" />
                {t}
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border border-white/5 bg-black/20 p-2">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)]">
              <BrainCircuit className="h-3 w-3 text-cyan-300" />
              Ask local AI
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void ask();
                }}
                placeholder="e.g. Safe approach from the south?"
                className="min-w-0 flex-1 rounded-xl border border-[var(--line-default)] bg-black/30 px-2.5 py-2 text-[12px] text-[var(--ink-1)] outline-none placeholder:text-[var(--ink-4)] focus:border-cyan-300/40"
              />
              <button
                type="button"
                onClick={() => void ask()}
                disabled={asking || !question.trim()}
                className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/20 text-cyan-100 disabled:opacity-40"
                aria-label="Ask"
              >
                {asking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            {askError ? (
              <p className="mt-1.5 text-[10px] text-red-300">{askError}</p>
            ) : null}
            {answer ? (
              <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-2)]">
                {answer}
              </p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[
                'Biggest threat right now?',
                'Where is the nearest cell heading?',
                'Safe observation tips?',
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setQuestion(q);
                  }}
                  className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-[var(--ink-3)] hover:bg-white/10"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
