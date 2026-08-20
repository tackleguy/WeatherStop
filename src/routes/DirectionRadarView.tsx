// Direction Radar — plan destination, start live route, split with radar.

import {
  BrainCircuit,
  Crosshair,
  ExternalLink,
  Loader2,
  Navigation,
  Play,
  Radar,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Square,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ActiveNavChip,
  ChaseScreenSwitcher,
} from '../components/direction/ChaseScreenSwitcher';
import { DirectionRadarMap } from '../components/direction/DirectionRadarMap';
import { RadarMap } from '../components/radar/RadarMap';
import { ProductRail } from '../components/radar/ProductRail';
import { TimeScrubber } from '../components/radar/TimeScrubber';
import { useAlerts } from '../hooks/useAlerts';
import { useGeolocation } from '../hooks/useGeolocation';
import { useGpsWatch } from '../hooks/useGpsWatch';
import { useIsMobile } from '../hooks/useMediaQuery';
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
import {
  etaMinutes,
  remainingMiles,
  type LonLat,
} from '../lib/navRoute';
import { composeLocalChaseBrief } from '../lib/stormChaseBrief';
import { alertStorms } from '../lib/stormIntelligence';
import { useRadarStore } from '../store/useRadarStore';

export function DirectionRadarView() {
  const { alerts } = useAlerts();
  const { settings } = useSettings();
  const isMobile = useIsMobile();
  const mapCenter = useRadarStore((s) => s.mapCenter);
  const setChaseOrigin = useRadarStore((s) => s.setChaseOrigin);
  const setSelectedViewSpotId = useRadarStore((s) => s.setSelectedViewSpotId);
  const chaseScreenMode = useRadarStore((s) => s.chaseScreenMode);
  const setChaseScreenMode = useRadarStore((s) => s.setChaseScreenMode);
  const navActive = useRadarStore((s) => s.navActive);
  const startNavRoute = useRadarStore((s) => s.startNavRoute);
  const stopNavRoute = useRadarStore((s) => s.stopNavRoute);
  const navDestination = useRadarStore((s) => s.navDestination);
  const navDestLabel = useRadarStore((s) => s.navDestLabel);
  const navRouteGeometry = useRadarStore((s) => s.navRouteGeometry);
  const navDistanceMi = useRadarStore((s) => s.navDistanceMi);
  const navDurationMin = useRadarStore((s) => s.navDurationMin);
  const updateNavProgress = useRadarStore((s) => s.updateNavProgress);

  const geo = useGeolocation();
  const { position: liveGps } = useGpsWatch(navActive);

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

  const livePos: LonLat | null = liveGps
    ? [liveGps.lon, liveGps.lat]
    : null;

  // Keep planning destination in sync when resuming an active nav.
  useEffect(() => {
    if (!navActive || !navDestination) return;
    setDestination(navDestination);
    if (navDestLabel) setDestLabel(navDestLabel);
    setDestLatInput(navDestination[1].toFixed(5));
    setDestLonInput(navDestination[0].toFixed(5));
  }, [navActive, navDestination, navDestLabel]);

  useEffect(() => {
    if (!navActive || !navRouteGeometry) return;
    setRoute((prev) =>
      prev?.geometry === navRouteGeometry
        ? prev
        : {
            geometry: navRouteGeometry,
            distanceMi: navDistanceMi ?? prev?.distanceMi ?? 0,
            durationMin: navDurationMin ?? prev?.durationMin ?? 0,
          },
    );
  }, [navActive, navRouteGeometry, navDistanceMi, navDurationMin]);

  const storms = useMemo(() => alertStorms(alerts), [alerts]);
  const spots = useMemo(
    () => viewingSpotsForStorms(storms, origin ?? mapCenter, 3),
    [storms, origin, mapCenter],
  );
  const ranked = useMemo(() => rankDestinationSpots(spots), [spots]);
  const brief = useMemo(
    () =>
      composeLocalChaseBrief(alerts, {
        center: livePos ?? origin ?? mapCenter,
        placeLabel: livePos || origin ? 'your GPS' : 'map center',
      }),
    [alerts, livePos, origin, mapCenter],
  );

  useEffect(() => {
    if (livePos && navActive) {
      setOrigin(livePos);
      setChaseOrigin(livePos);
      return;
    }
    if (origin) return;
    if (geo.coords) {
      const next: LonLat = [geo.coords.longitude, geo.coords.latitude];
      setOrigin(next);
      setChaseOrigin(next);
      return;
    }
    if (mapCenter) setOrigin(mapCenter);
  }, [geo.coords, mapCenter, origin, livePos, navActive, setChaseOrigin]);

  useEffect(() => {
    void geo.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Plan route from origin → destination (not while continuously re-routing GPS).
  useEffect(() => {
    if (navActive) return;
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
  }, [navActive, origin, destination?.[0], destination?.[1]]);

  // While navigating, refresh remaining mi from live GPS.
  useEffect(() => {
    if (!navActive || !livePos || !destination) return;
    const geom = navRouteGeometry ?? route?.geometry ?? null;
    const rem = remainingMiles(livePos, geom, destination);
    const eta = etaMinutes(rem);
    updateNavProgress(rem, eta);
  }, [
    navActive,
    livePos,
    destination,
    route?.geometry,
    navRouteGeometry,
    updateNavProgress,
  ]);

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

  const startRoute = async () => {
    if (!destination) {
      setAiError('Set a destination first (AI fill or pick a perch)');
      return;
    }
    let from = origin;
    const coords = await geo.request();
    if (coords) {
      from = [coords.longitude, coords.latitude];
      setOrigin(from);
      setChaseOrigin(from);
    }
    if (!from) {
      setAiError('Need GPS or map position to start');
      return;
    }

    setRouting(true);
    const driven = await fetchDriveRoute(from, destination);
    setRouting(false);
    const geometry = driven?.geometry ?? route?.geometry ?? null;
    if (driven) setRoute(driven);

    startNavRoute({
      destination,
      destLabel,
      routeGeometry: geometry,
      distanceMi: driven?.distanceMi ?? route?.distanceMi ?? null,
      durationMin: driven?.durationMin ?? route?.durationMin ?? null,
    });
    setChaseScreenMode('split');
    setAiStatus(`Route started → ${destLabel}`);
    setAiError(null);
  };

  const endRoute = () => {
    stopNavRoute();
    setChaseScreenMode('directions');
    setAiStatus('Route ended');
  };

  const showPlanner =
    chaseScreenMode === 'directions' || chaseScreenMode === 'split';
  const showDirMap =
    chaseScreenMode === 'directions' || chaseScreenMode === 'split';
  const showRadar =
    chaseScreenMode === 'split' || chaseScreenMode === 'radar';

  const mapGeometry = navActive
    ? (navRouteGeometry ?? route?.geometry ?? null)
    : (route?.geometry ?? null);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <header className="border-b border-[var(--line-subtle)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="mr-auto min-w-0">
            <p className="section-eyebrow">Storm Chaser</p>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--ink-1)]">
              <Radar className="h-5 w-5 text-cyan-300" />
              Direction Radar
            </h1>
            <p className="mt-1 max-w-xl text-[13px] text-[var(--ink-3)]">
              {navActive
                ? 'Live route — GPS maps you to the perch. Flip Directions / Split / Radar.'
                : 'AI fills a destination, then Start route to follow it on the map.'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ChaseScreenSwitcher />
            <div className="flex flex-wrap justify-end gap-2">
              <Link to="/radar" className="chip-button">
                Full radar
              </Link>
              {!navActive ? (
                <button
                  type="button"
                  disabled={!destination || routing}
                  onClick={() => void startRoute()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400/30 px-3 py-1.5 text-[12px] font-semibold text-emerald-100 disabled:opacity-40"
                >
                  {routing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Start route
                </button>
              ) : (
                <button
                  type="button"
                  onClick={endRoute}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-400/25 px-3 py-1.5 text-[12px] font-semibold text-red-100"
                >
                  <Square className="h-3.5 w-3.5" />
                  End route
                </button>
              )}
            </div>
          </div>
        </div>
        {navActive ? (
          <div className="mt-2">
            <ActiveNavChip />
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          className={`grid h-full min-h-0 ${
            chaseScreenMode === 'split'
              ? 'lg:grid-cols-[minmax(280px,360px)_1fr_1fr]'
              : chaseScreenMode === 'radar'
                ? 'grid-cols-1'
                : 'lg:grid-cols-[minmax(320px,420px)_1fr]'
          }`}
        >
          {showPlanner ? (
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
                  {(livePos ?? origin)
                    ? `${(livePos ?? origin)![1].toFixed(4)}, ${(livePos ?? origin)![0].toFixed(4)}`
                    : 'Waiting for location…'}
                  {navActive ? (
                    <span className="ml-2 text-cyan-300">· tracking</span>
                  ) : null}
                </p>
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

                {destination ? (
                  <div className="space-y-2 border-t border-[var(--line-subtle)] pt-3">
                    <p className="text-[12px] text-[var(--ink-2)]">
                      {routing ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Routing…
                        </span>
                      ) : route || navActive ? (
                        <>
                          ~
                          {(navDistanceMi ?? route?.distanceMi ?? 0).toFixed(1)}{' '}
                          mi · ~
                          {Math.round(navDurationMin ?? route?.durationMin ?? 0)}{' '}
                          min
                          {navActive ? ' remaining' : ' drive'}
                        </>
                      ) : (
                        'Route unavailable — still open Organic Maps'
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {!navActive ? (
                        <button
                          type="button"
                          onClick={() => void startRoute()}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-400/25 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-100"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Start route
                        </button>
                      ) : null}
                      <a
                        href={organicMapsDirUrl(destination, {
                          from: livePos ?? origin,
                          destinationName: destLabel,
                          originName: 'Chase start',
                          navigate: navActive,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-400/15 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-100/90"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Organic Maps
                        <ExternalLink className="h-3 w-3 opacity-70" />
                      </a>
                      <a
                        href={organicMapsAppUrl(
                          destination,
                          livePos ?? origin,
                          destLabel,
                        )}
                        className="inline-flex items-center gap-1 rounded-xl bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-[var(--ink-3)]"
                      >
                        om://
                      </a>
                      <a
                        href={googleMapsDirUrl(destination, livePos ?? origin)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-xl bg-cyan-400/20 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-100"
                      >
                        Google
                      </a>
                      <a
                        href={appleMapsDirUrl(destination, livePos ?? origin)}
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
                    No TOR/SVR-derived spots yet. When warnings are active, AI
                    can fill a destination for you.
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
                Advisory geometry only — never enter a tornado warning to reach
                a perch.
              </p>
            </aside>
          ) : null}

          {showDirMap ? (
            <div
              className={`relative min-h-[36vh] p-3 sm:p-4 ${
                chaseScreenMode === 'split' ? 'lg:min-h-0' : 'lg:min-h-0'
              }`}
            >
              <DirectionRadarMap
                origin={origin}
                destination={destination}
                routeGeometry={mapGeometry}
                livePosition={livePos}
                navigating={navActive}
                followLive={navActive}
              />
            </div>
          ) : null}

          {showRadar ? (
            <div className="relative flex min-h-[40vh] flex-col overflow-hidden border-t border-[var(--line-subtle)] lg:min-h-0 lg:border-t-0 lg:border-l">
              {!isMobile && chaseScreenMode === 'radar' ? (
                <div className="absolute left-3 top-3 z-20">
                  <ProductRail />
                </div>
              ) : null}
              <div className="relative min-h-0 flex-1">
                <RadarMap />
                {chaseScreenMode === 'radar' ? (
                  <div className="pointer-events-none absolute left-3 top-3 z-20">
                    <ActiveNavChip />
                  </div>
                ) : null}
              </div>
              {chaseScreenMode === 'radar' ? <TimeScrubber /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
