import { useEffect, useMemo, useState } from 'react';
import { useAlerts } from './useAlerts';
import {
  fetchDriveRoute,
  viewingSpotsForStorms,
  type ViewingSpot,
} from '../lib/chaseViewing';
import { alertStorms } from '../lib/stormIntelligence';
import { useRadarStore } from '../store/useRadarStore';

export function useChaseViewing(enabled: boolean) {
  const { alerts } = useAlerts();
  const mapCenter = useRadarStore((s) => s.mapCenter);
  const selectedSpotId = useRadarStore((s) => s.selectedViewSpotId);
  const setSelectedViewSpotId = useRadarStore((s) => s.setSelectedViewSpotId);
  const chaseOrigin = useRadarStore((s) => s.chaseOrigin);
  const setChaseOrigin = useRadarStore((s) => s.setChaseOrigin);

  const storms = useMemo(() => alertStorms(alerts), [alerts]);
  const origin = chaseOrigin ?? mapCenter;

  const spots = useMemo(
    () => (enabled ? viewingSpotsForStorms(storms, origin) : []),
    [enabled, storms, origin],
  );

  const selected =
    spots.find((s) => s.id === selectedSpotId) ?? spots[0] ?? null;

  useEffect(() => {
    if (!enabled) return;
    if (selectedSpotId && spots.some((s) => s.id === selectedSpotId)) return;
    if (spots[0]) setSelectedViewSpotId(spots[0].id);
  }, [enabled, spots, selectedSpotId, setSelectedViewSpotId]);

  const [route, setRoute] = useState<{
    geometry: GeoJSON.LineString;
    distanceMi: number;
    durationMin: number;
  } | null>(null);
  const [routing, setRouting] = useState(false);

  useEffect(() => {
    if (!enabled || !origin || !selected) {
      setRoute(null);
      return;
    }
    const ac = new AbortController();
    setRouting(true);
    fetchDriveRoute(origin, selected.center, ac.signal)
      .then((r) => {
        if (!ac.signal.aborted) setRoute(r);
      })
      .finally(() => {
        if (!ac.signal.aborted) setRouting(false);
      });
    return () => ac.abort();
  }, [enabled, origin, selected?.id, selected?.center[0], selected?.center[1]]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setChaseOrigin([pos.coords.longitude, pos.coords.latitude]);
      },
      () => {
        // keep map center
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return {
    storms,
    spots,
    selected: selected as ViewingSpot | null,
    setSelectedViewSpotId,
    origin,
    route,
    routing,
    useMyLocation,
  };
}
