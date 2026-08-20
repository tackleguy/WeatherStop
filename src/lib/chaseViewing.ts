// Chase viewing / footage waypoints + drive directions helpers.
// Spots stay outside warned radii and bias to the classic right-flank
// structure look for NE-bound Plains storms (adjusts with NWS motion).

import {
  destination,
  type StormIntel,
} from './stormIntelligence';

export type ViewingKind = 'footage' | 'structure' | 'wide';

export interface ViewingSpot {
  id: string;
  stormId: string;
  kind: ViewingKind;
  label: string;
  tip: string;
  /** lon, lat */
  center: [number, number];
  /** Driving distance from origin when known. */
  driveMi?: number;
  bearingFromStorm: number;
  distanceMi: number;
}

const KIND_META: Record<
  ViewingKind,
  { label: string; tip: string; flankDeg: number; miles: number }
> = {
  footage: {
    label: 'Footage perch',
    tip: 'Right-flank / inflow look — stay outside the warning polygon',
    flankDeg: 110,
    miles: 11,
  },
  structure: {
    label: 'Structure shot',
    tip: 'Slightly farther right-rear for anvil / shelf structure',
    flankDeg: 135,
    miles: 15,
  },
  wide: {
    label: 'Wide establish',
    tip: 'Safer pull-off for wide landscape + lightning-safe spacing',
    flankDeg: 150,
    miles: 20,
  },
};

function haversineMi(
  a: [number, number],
  b: [number, number],
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.7613;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const A =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(A));
}

function motionBearing(storm: StormIntel): number {
  if (storm.motionBearing != null && Number.isFinite(storm.motionBearing)) {
    return storm.motionBearing;
  }
  // Default Plains storm motion when NWS text has no MOVING clause.
  return 45;
}

/** Build 1–3 viewing spots for the highest-priority storms. */
export function viewingSpotsForStorms(
  storms: StormIntel[],
  origin?: [number, number] | null,
  limitStorms = 2,
): ViewingSpot[] {
  const ranked = [...storms].sort((a, b) => {
    const rank = { extreme: 4, high: 3, moderate: 2, low: 1 };
    return rank[b.danger] - rank[a.danger];
  });
  const spots: ViewingSpot[] = [];
  for (const storm of ranked.slice(0, limitStorms)) {
    const move = motionBearing(storm);
    const minMi = Math.max(8, storm.radiusKm * 0.621371 + 3);
    for (const kind of ['footage', 'structure', 'wide'] as ViewingKind[]) {
      const meta = KIND_META[kind];
      const miles = Math.max(minMi, meta.miles);
      const bearing = (move + meta.flankDeg) % 360;
      const center = destination(storm.center, bearing, miles * 1.60934);
      spots.push({
        id: `${storm.id}:${kind}`,
        stormId: storm.id,
        kind,
        label: meta.label,
        tip: meta.tip,
        center,
        bearingFromStorm: bearing,
        distanceMi: Math.round(miles * 10) / 10,
        driveMi: origin
          ? Math.round(haversineMi(origin, center) * 10) / 10
          : undefined,
      });
    }
  }
  return spots;
}

export function viewingSpotsGeoJSON(spots: ViewingSpot[]): {
  points: GeoJSON.FeatureCollection;
  spokes: GeoJSON.FeatureCollection;
} {
  const points: GeoJSON.Feature[] = spots.map((s) => ({
    type: 'Feature',
    properties: {
      id: s.id,
      kind: s.kind,
      label: s.label,
      tip: s.tip,
      stormId: s.stormId,
    },
    geometry: { type: 'Point', coordinates: s.center },
  }));
  return {
    points: { type: 'FeatureCollection', features: points },
    spokes: { type: 'FeatureCollection', features: [] },
  };
}

export function googleMapsDirUrl(
  to: [number, number],
  from?: [number, number] | null,
): string {
  const dest = `${to[1]},${to[0]}`;
  if (from) {
    return `https://www.google.com/maps/dir/?api=1&origin=${from[1]},${from[0]}&destination=${dest}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

export function appleMapsDirUrl(
  to: [number, number],
  from?: [number, number] | null,
): string {
  const daddr = `${to[1]},${to[0]}`;
  if (from) {
    return `https://maps.apple.com/?saddr=${from[1]},${from[0]}&daddr=${daddr}&dirflg=d`;
  }
  return `https://maps.apple.com/?daddr=${daddr}&dirflg=d`;
}

/** OSRM public router — draw a drive path on the map (no API key). */
export async function fetchDriveRoute(
  from: [number, number],
  to: [number, number],
  signal?: AbortSignal,
): Promise<{
  geometry: GeoJSON.LineString;
  distanceMi: number;
  durationMin: number;
} | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from[0]},${from[1]};${to[0]},${to[1]}` +
    `?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: GeoJSON.LineString;
      }>;
    };
    const route = body.routes?.[0];
    if (!route?.geometry) return null;
    return {
      geometry: route.geometry,
      distanceMi: Math.round(((route.distance ?? 0) / 1609.34) * 10) / 10,
      durationMin: Math.round((route.duration ?? 0) / 60),
    };
  } catch {
    return null;
  }
}
