// Storm chase mode HUD — viewing directions, Dom 3 tracker, local AI ask.

import {
  BrainCircuit,
  Crosshair,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Radio,
  Send,
  ShieldAlert,
  Truck,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlerts } from '../../hooks/useAlerts';
import { useChaseViewing } from '../../hooks/useChaseViewing';
import { useDom3Track } from '../../hooks/useDom3Track';
import { useSettings } from '../../hooks/useSettings';
import { alertsPageHref } from '../../lib/alertsNav';
import {
  appleMapsDirUrl,
  googleMapsDirUrl,
} from '../../lib/chaseViewing';
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
  const dom3TrackEnabled = useRadarStore((s) => s.dom3TrackEnabled);
  const setDom3TrackEnabled = useRadarStore((s) => s.setDom3TrackEnabled);
  const navigate = useNavigate();
  const { alerts } = useAlerts();
  const { settings } = useSettings();
  const {
    spots,
    selected,
    setSelectedViewSpotId,
    origin,
    route,
    routing,
    useMyLocation,
  } = useChaseViewing(chaseMode);
  const { fix: dom3, loading: dom3Loading, refresh: refreshDom3 } = useDom3Track(
    chaseMode && dom3TrackEnabled,
    settings.dom3FeedUrl,
  );

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
  const [tab, setTab] = useState<'view' | 'dom3' | 'ai'>('view');

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
      .catch(() => {})
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

        <div className="flex gap-1 border-b border-white/5 px-2 py-1.5">
          {(
            [
              { id: 'view', label: 'View spots' },
              { id: 'dom3', label: 'Dom 3' },
              { id: 'ai', label: 'AI' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                tab === t.id
                  ? 'bg-cyan-400/20 text-cyan-100'
                  : 'text-[var(--ink-4)] hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[min(58vh,480px)] space-y-3 overflow-y-auto px-3.5 py-3">
          {tab === 'view' ? (
            <>
              <div className="flex items-start gap-2">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div>
                  <h3 className="text-[13px] font-semibold text-[var(--ink-1)]">
                    {brief.headline}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-3)]">
                    Pink / purple markers are footage & structure perches outside
                    warned radii. Cyan line is the drive route.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={useMyLocation}
                  className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-medium text-[var(--ink-2)]"
                >
                  Use my GPS as start
                </button>
                {routing ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-[var(--ink-4)]">
                    <Loader2 className="h-3 w-3 animate-spin" /> Routing…
                  </span>
                ) : route ? (
                  <span className="text-[10px] text-cyan-200/80">
                    {route.distanceMi} mi · ~{route.durationMin} min
                  </span>
                ) : null}
              </div>

              {spots.length === 0 ? (
                <p className="text-[12px] text-[var(--ink-3)]">
                  No TOR/SVR cells to build viewing spots. Pan to an active warning.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {spots.map((spot) => {
                    const active = selected?.id === spot.id;
                    return (
                      <button
                        key={spot.id}
                        type="button"
                        onClick={() => setSelectedViewSpotId(spot.id)}
                        className={`w-full rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                          active
                            ? 'border-pink-300/40 bg-pink-400/10'
                            : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-semibold text-[var(--ink-1)]">
                            {spot.label}
                          </span>
                          <span className="text-[10px] text-[var(--ink-4)]">
                            {spot.distanceMi} mi from cell
                            {spot.driveMi != null ? ` · ${spot.driveMi} mi drive` : ''}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-[var(--ink-3)]">
                          {spot.tip}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {selected ? (
                <div className="flex flex-wrap gap-1.5">
                  <a
                    href={googleMapsDirUrl(selected.center, origin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl bg-cyan-400/20 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-100"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Google Maps
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </a>
                  <a
                    href={appleMapsDirUrl(selected.center, origin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ink-1)]"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Apple Maps
                  </a>
                </div>
              ) : null}

              <p className="text-[9px] leading-relaxed text-[var(--ink-4)]">
                Spots are advisory geometry for structure/footage — never enter a
                tornado warning. Roads may not reach the pin; stop at a safe pull-off.
              </p>
            </>
          ) : null}

          {tab === 'dom3' ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-amber-300" />
                  <span className="text-[13px] font-semibold text-[var(--ink-1)]">
                    Dominator 3 tracker
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={dom3TrackEnabled}
                  onClick={() => setDom3TrackEnabled(!dom3TrackEnabled)}
                  className={`relative h-6 w-10 rounded-full ${
                    dom3TrackEnabled ? 'bg-amber-400/80' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      dom3TrackEnabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {dom3Loading ? (
                <p className="flex items-center gap-2 text-[12px] text-[var(--ink-3)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Checking Dom 3 feed…
                </p>
              ) : null}

              {dom3?.available && dom3.lat != null && dom3.lon != null ? (
                <div className="rounded-2xl border border-amber-300/25 bg-amber-400/[0.08] px-3 py-3">
                  <div className="text-[13px] font-semibold text-[var(--ink-1)]">
                    {dom3.label}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--ink-3)]">
                    {dom3.lat.toFixed(4)}, {dom3.lon.toFixed(4)}
                    {dom3.speedMph != null ? ` · ${dom3.speedMph} mph` : ''}
                    {dom3.heading != null
                      ? ` · ${compass(dom3.heading)}`
                      : ''}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--ink-4)]">
                    Source: {dom3.source ?? 'feed'}
                    {dom3.updatedAt
                      ? ` · ${new Date(dom3.updatedAt).toLocaleTimeString()}`
                      : ''}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <a
                      href={googleMapsDirUrl([dom3.lon, dom3.lat], origin)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-400/20 px-2 py-1 text-[10px] font-semibold text-amber-100"
                    >
                      Navigate to Dom 3
                    </a>
                    <button
                      type="button"
                      onClick={() => refreshDom3()}
                      className="rounded-lg bg-white/10 px-2 py-1 text-[10px] text-[var(--ink-2)]"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3 text-[12px] leading-relaxed text-[var(--ink-3)]">
                  <p className="font-medium text-[var(--ink-2)]">
                    No live Dom 3 feed
                  </p>
                  <p className="mt-1">
                    Team Dominator does not publish a public GPS API. Add a JSON
                    or GeoJSON feed URL in{' '}
                    <strong className="text-[var(--ink-2)]">Settings → Local AI</strong>{' '}
                    (Dom 3 feed), or set server env{' '}
                    <code className="text-[10px] text-[var(--ink-3)]">
                      DOM3_FEED_URL
                    </code>{' '}
                    / APRS callsign +{' '}
                    <code className="text-[10px] text-[var(--ink-3)]">
                      APRS_API_KEY
                    </code>
                    .
                  </p>
                  {dom3?.error ? (
                    <p className="mt-2 text-[10px] text-[var(--ink-4)]">
                      {dom3.error}
                    </p>
                  ) : null}
                </div>
              )}
              <p className="text-[9px] text-[var(--ink-4)]">
                {dom3?.disclaimer ??
                  'Not affiliated with Team Dominator. Only show licensed/public positions.'}
              </p>
            </>
          ) : null}

          {tab === 'ai' ? (
            <>
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
                    placeholder="Best footage approach?"
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
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
