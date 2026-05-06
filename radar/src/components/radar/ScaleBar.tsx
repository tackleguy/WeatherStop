// Horizontal scale bar derived from the current map zoom + center lat.
// MapLibre has a built-in ScaleControl but its styling is fixed; this
// version matches the rest of the chrome and shows both miles and km.

import { useEffect, useMemo, useState } from 'react';
import type maplibregl from 'maplibre-gl';

interface Props {
  map: maplibregl.Map | null;
}

const NICE_STEPS_MI = [
  0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000,
];
const TARGET_PX = 120;

export function ScaleBar({ map }: Props) {
  const [zoom, setZoom] = useState(map?.getZoom() ?? 4);
  const [lat, setLat] = useState(map?.getCenter().lat ?? 39);

  useEffect(() => {
    if (!map) return;
    const update = () => {
      setZoom(map.getZoom());
      setLat(map.getCenter().lat);
    };
    update();
    map.on('move', update);
    return () => {
      map.off('move', update);
    };
  }, [map]);

  const computed = useMemo(() => {
    // Web mercator: meters/pixel at the equator at a given zoom.
    const mPerPxEq = (40075016.686 / 256) / Math.pow(2, zoom);
    // Adjust for latitude (cosφ).
    const mPerPx = mPerPxEq * Math.cos((lat * Math.PI) / 180);
    const milesAt120px = (TARGET_PX * mPerPx) / 1609.344;

    // Snap to a nice step.
    const niceMi =
      NICE_STEPS_MI.find((s) => s >= milesAt120px) ??
      NICE_STEPS_MI[NICE_STEPS_MI.length - 1];
    const px = (niceMi * 1609.344) / mPerPx;
    return {
      width: Math.max(40, Math.min(220, px)),
      miles: niceMi,
      km: niceMi * 1.60934,
    };
  }, [zoom, lat]);

  return (
    <div
      className="pointer-events-none absolute bottom-3 left-3 z-10 select-none rounded-md border border-[var(--line-subtle)] bg-black/45 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-2)] backdrop-blur"
      data-num
    >
      <div className="mb-0.5">{prettyMiles(computed.miles)}</div>
      <div
        style={{ width: `${computed.width}px` }}
        className="h-1 rounded-sm bg-[var(--ink-1)]"
      />
      <div className="mt-0.5">{prettyKm(computed.km)}</div>
    </div>
  );
}

function prettyMiles(mi: number): string {
  if (mi < 1) return `${(mi * 5280).toFixed(0)} ft`;
  return `${mi >= 10 ? mi.toFixed(0) : mi.toFixed(1)} mi`;
}
function prettyKm(km: number): string {
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  return `${km >= 10 ? km.toFixed(0) : km.toFixed(1)} km`;
}
