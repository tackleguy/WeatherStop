// Direction Radar — GPS → AI-recommended chase perch → Organic Maps drive.

import {
  BrainCircuit,
  Crosshair,
  ExternalLink,
  Loader2,
  Navigation,
  Radar,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DirectionRadarMap } from '../components/direction/DirectionRadarMap';
import { useAlerts } from '../hooks/useAlerts';
import { useGeolocation } from '../hooks/useGeolocation';
import { useSettings } from '../hooks/useSettings';
import {
  appleMapsDirUrl,
  fetchDriveRoute,
  googleMapsDirUrl,
  organicMapsAppUrl,
  organicMapsDirUrl,
  viewingSpotsForStorms,
  type ViewingSpot,
} from '../lib/chaseViewing';
import {
  pickRankedDestination,
  rankDestinationSpots,
  recommendDestination,
  type DestinationPick,
} from '../lib/directionRecommend';
import {
  DEFAULT_LOCAL_AI,
  probeLocalAi,
  type LocalAiSettings,
} from '../lib/localAi';
import { composeLocalChaseBrief } from '../lib/stormChaseBrief';
import { alertStorms } from '../lib/stormIntelligence';
import { useRadarStore } from '../store/useRadarStore';

type LonLat = [number, number];

export function DirectionRadarView() {
  const { alerts } = useAlerts();
  const { settings } = useSettings();
  const mapCenter = useRadarStore((s) => s.mapCenter);
  const setChaseOrigin = useRadarStore((s) => s.setChaseOrigin);
  const setSelectedViewSpotId = useRadarStore((s) => s.setSelectedViewSpotId);
  const geo = useGeolocation();

  const [origin, setOrigin] = useState<LonLat | null>(null);
  const [destination, setDestination] = useState<LonLat | null>(null);
  const [destLabel, setDestLabel] = useState('Chase destination');
  const [destLatInput, setDestLatInput] = useState('');
  const [destLonInput, setDestLonInput] = useState('');
  const [intent, setIntent] = useState('');
  const [pick, setPick] = useState<DestinationPick | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [route, setRoute] = useState<{
    geometry: GeoJSON.LineString;
    distanceMi: number;
    durationMin: number;
  } | null>(null);
  const [routing, setRouting] = useState(false);

  const localAi: LocalAiSettings = {
    enabled: settings.localAiEnabled ?? DEFAULT_LOCAL_AI.enabled,
    url: settings.localAiUrl?.trim() || DEFAULT_LOCAL_AI.url,
    model: settings.localAiModel?.trim() || DEFAULT_LOCAL_AI.model,
  };

  const storms = useMemo(() => alertStorms(alerts), [alerts]);
  const spots = useMemo(
    () => viewingSpotsForStorms(storms, origin ?? mapCenter, 3),
    [storms, origin, mapCenter],
  );
  const ranked = useMemo(() => rankDestinationSpots(spots), [spots]);
  const brief = useMemo(
    () =>
      composeLocalChaseBrief(alerts, {
        center: origin ?? mapCenter,
        placeLabel: origin ? 'your GPS' : 'map center',
      }),
    [alerts, origin, mapCenter],
  );

  // Prefer GPS; fall back to radar map center.
  useEffect(() => {
    if (origin) return;
    if (geo.coords) {
      const next: LonLat = [geo.coords.longitude, geo.coords.latitude];
      setOrigin(next);
      setChaseOrigin(next);
      return;
    }
    if (mapCenter) setOrigin(mapCenter);
  }, [geo.coords, mapCenter, origin, setChaseOrigin]);

  useEffect(() => {
    void geo.request();
    // one-shot on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!origin || !destination) {
      setRoute(null);
      return;
    }
    const ac = new AbortController();
    setRouting(true);
    fetchDriveRoute(origin, destination, ac.signal)
      .then((r) => {
        if (!ac.signal.aborted) setRoute(r);
      })
      .finally(() => {
        if (!ac.signal.aborted) setRouting(false);
      });
    return () => ac.abort();
  }, [origin, destination?.[0], destination?.[1]]);

  const applyPick = (next: DestinationPick) => {
    setPick(next);
    setDestination(next.center);
    setDestLabel(next.label);
    setDestLatInput(next.center[1].toFixed(5));
    setDestLonInput(next.center[0].toFixed(5));
    setSelectedViewSpotId(next.spotId);
    setAiStatus(next.reason);
    setAiError(null);
  };

  const applyManualCoords = () => {
    const lat = Number(destLatInput);
    const lon = Number(destLonInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setAiError('Enter valid destination lat / lon');
      return;
    }
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      setAiError('Lat must be ±90 and lon ±180');
      return;
    }
    setDestination([lon, lat]);
    setPick(null);
    setAiStatus('Manual destination set');
    setAiError(null);
  };

  const useGps = async () => {
    const coords = await geo.request();
    if (!coords) {
      setAiError(geo.error ?? 'Location unavailable');
      return;
    }
    const next: LonLat = [coords.longitude, coords.latitude];
    setOrigin(next);
    setChaseOrigin(next);
  };

  const runAiRecommend = async (fillOnly = false) => {
    setAiBusy(true);
    setAiError(null);
    try {
      const probe = await probeLocalAi(localAi);
      setAiStatus(
        probe.ok
          ? `Local AI ready (${probe.via}) — choosing perch…`
          : 'Local AI offline — using NWS-ranked perch…',
      );

      let next: DestinationPick | null = null;
      if (probe.ok && !fillOnly) {
        next = await recommendDestination(
          spots,
          brief,
          localAi,
          intent || undefined,
        );
      } else {
        next = pickRankedDestination(spots);
        if (next && fillOnly) {
          next = {
            ...next,
            reason: `Filled from ranked spots (AI offline: ${probe.detail})`,
          };
        }
      }

      if (!next) {
        setAiError(
          storms.length
            ? 'No viewing spots for active storms'
            : 'No severe storms in alerts — wait for TOR/SVR or open Radar',
        );
        return;
      }
      applyPick(next);
    } catch (err) {
      const fallback = pickRankedDestination(spots);
      if (fallback) {
        applyPick({
          ...fallback,
          reason: `${fallback.reason} (AI error — used ranked fallback)`,
        });
      } else {
        setAiError(err instanceof Error ? err.message : 'Recommend failed');
      }
    } finally {
      setAiBusy(false);
    }
  };

  const selectSpot = (spot: ViewingSpot) => {
    applyPick({
      spotId: spot.id,
      label: spot.label,
      center: spot.center,
      kind: spot.kind,
      driveMi: spot.driveMi,
      source: 'ranked',
      reason: spot.tip,
    });
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <header className="border-b border-[var(--line-subtle)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="mr-auto min-w-0">
            <p className="section-eyebrow">Storm Chaser</p>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--ink-1)]">
              <Radar className="h-5 w-5 text-cyan-300" />
              Direction Radar
            </h1>
            <p className="mt-1 max-w-xl text-[13px] text-[var(--ink-3)]">
              From your GPS to a safe viewing perch. Local AI recommends a
              destination and fills it in — then open Organic Maps for turn-by-turn.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/radar" className="chip-button">
              Open radar
            </Link>
            <Link to="/storm" className="chip-button">
              Storm AI
            </Link>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 lg:grid-cols-[minmax(320px,420px)_1fr]">
          <aside className="min-h-0 space-y-3 overflow-y-auto border-b border-[var(--line-subtle)] px-4 py-4 sm:px-5 lg:border-b-0 lg:border-r">
            <section className="panel panel-padded space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="card-label mb-0">Your position</h2>
                <button
                  type="button"
                  onClick={() => void useGps()}
                  className="chip-button inline-flex items-center gap-1.5"
                >
                  {geo.status === 'requesting' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Crosshair className="h-3.5 w-3.5" />
                  )}
                  Use GPS
                </button>
              </div>
              <p className="font-mono text-[12px] text-[var(--ink-2)]">
                {origin
                  ? `${origin[1].toFixed(4)}, ${origin[0].toFixed(4)}`
                  : 'Waiting for location…'}
              </p>
              {geo.status === 'denied' ? (
                <p className="text-[11px] text-amber-200/90">
                  Location denied — using map center. Enable GPS for true
                  directions.
                </p>
              ) : null}
            </section>

            <section className="panel panel-padded space-y-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-cyan-300" />
                <h2 className="card-label mb-0">AI destination</h2>
              </div>
              <p className="text-[12px] leading-relaxed text-[var(--ink-3)]">
                {brief.headline}
              </p>
              <label className="block space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-[var(--ink-4)]">
                  What you want
                </span>
                <input
                  type="text"
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder="e.g. structure shot, footage, safer wide view"
                  className="w-full rounded-xl border border-[var(--line-default)] bg-black/20 px-3 py-2 text-[13px] text-[var(--ink-1)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={aiBusy || !spots.length}
                  onClick={() => void runAiRecommend(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400/25 px-3 py-2 text-[12px] font-semibold text-cyan-100 disabled:opacity-40"
                >
                  {aiBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  AI recommend & fill
                </button>
                <button
                  type="button"
                  disabled={aiBusy || !spots.length}
                  onClick={() => void runAiRecommend(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[12px] font-medium text-[var(--ink-2)] disabled:opacity-40"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Fill ranked
                </button>
              </div>
              {aiStatus ? (
                <p className="text-[12px] leading-relaxed text-[var(--ink-2)]">
                  {aiStatus}
                </p>
              ) : null}
              {aiError ? (
                <p className="text-[12px] text-red-300">{aiError}</p>
              ) : null}
              {pick ? (
                <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-[11px] text-cyan-100/90">
                  Filled: <strong>{pick.label}</strong> · {pick.kind}
                  {pick.source === 'local-ai' ? ' · local AI' : ' · ranked'}
                  {pick.driveMi != null ? ` · ~${pick.driveMi} mi` : ''}
                </div>
              ) : null}
            </section>

            <section className="panel panel-padded space-y-3">
              <h2 className="card-label">Destination</h2>
              <label className="block space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-[var(--ink-4)]">
                  Name
                </span>
                <input
                  type="text"
                  value={destLabel}
                  onChange={(e) => setDestLabel(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line-default)] bg-black/20 px-3 py-2 text-[13px] text-[var(--ink-1)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--ink-4)]">
                    Lat
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={destLatInput}
                    onChange={(e) => setDestLatInput(e.target.value)}
                    className="w-full rounded-xl border border-[var(--line-default)] bg-black/20 px-3 py-2 font-mono text-[12px] text-[var(--ink-1)] outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--ink-4)]">
                    Lon
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={destLonInput}
                    onChange={(e) => setDestLonInput(e.target.value)}
                    className="w-full rounded-xl border border-[var(--line-default)] bg-black/20 px-3 py-2 font-mono text-[12px] text-[var(--ink-1)] outline-none focus:border-[var(--accent)]"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={applyManualCoords}
                className="chip-button"
              >
                Apply coordinates
              </button>

              {destination && origin ? (
                <div className="space-y-2 border-t border-[var(--line-subtle)] pt-3">
                  <p className="text-[12px] text-[var(--ink-2)]">
                    {routing ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Routing…
                      </span>
                    ) : route ? (
                      <>
                        ~{route.distanceMi.toFixed(1)} mi · ~
                        {Math.round(route.durationMin)} min drive
                      </>
                    ) : (
                      'Route unavailable — still open Organic Maps'
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <a
                      href={organicMapsDirUrl(destination, {
                        from: origin,
                        destinationName: destLabel,
                        originName: 'Chase start',
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-400/25 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-100"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Organic Maps
                      <ExternalLink className="h-3 w-3 opacity-70" />
                    </a>
                    <a
                      href={organicMapsDirUrl(destination, {
                        navigate: true,
                        destinationName: destLabel,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-400/15 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-100/90"
                    >
                      Nav from GPS
                    </a>
                    <a
                      href={organicMapsAppUrl(destination, origin, destLabel)}
                      className="inline-flex items-center gap-1 rounded-xl bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-[var(--ink-3)]"
                    >
                      om://
                    </a>
                    <a
                      href={googleMapsDirUrl(destination, origin)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl bg-cyan-400/20 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-100"
                    >
                      Google
                    </a>
                    <a
                      href={appleMapsDirUrl(destination, origin)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ink-1)]"
                    >
                      Apple
                    </a>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="panel panel-padded space-y-2">
              <h2 className="card-label">Suggested perches</h2>
              {!ranked.length ? (
                <p className="text-[12px] text-[var(--ink-4)]">
                  No TOR/SVR-derived spots yet. When warnings are active, AI can
                  fill a destination for you.
                </p>
              ) : (
                ranked.slice(0, 6).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectSpot(s)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      pick?.spotId === s.id
                        ? 'border-cyan-300/40 bg-cyan-400/15'
                        : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="text-[12px] font-semibold text-[var(--ink-1)]">
                      {s.label}
                      {s.driveMi != null ? (
                        <span className="ml-2 font-normal text-[var(--ink-4)]">
                          ~{s.driveMi} mi
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[10px] text-[var(--ink-4)]">
                      {s.tip}
                    </div>
                  </button>
                ))
              )}
            </section>

            <p className="flex items-start gap-2 px-1 text-[10px] leading-relaxed text-[var(--ink-4)]">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/80" />
              Advisory geometry only — never enter a tornado warning to reach a
              perch. Life safety beats the shot.
            </p>
          </aside>

          <div className="relative min-h-[40vh] p-3 sm:p-4 lg:min-h-0">
            <DirectionRadarMap
              origin={origin}
              destination={destination}
              routeGeometry={route?.geometry ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
