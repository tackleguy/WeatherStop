// Active chase navigation — remaining distance along an OSRM line.

export type LonLat = [number, number];

export function haversineMi(a: LonLat, b: LonLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.7613;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const A =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(A));
}

/** Index of the closest vertex on the route to `pos`. */
export function nearestRouteIndex(
  pos: LonLat,
  coords: LonLat[],
): number {
  if (!coords.length) return 0;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i]!;
    const d = haversineMi(pos, c);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Remaining polyline from the nearest vertex to the end (plus live pos). */
export function remainingRouteGeometry(
  pos: LonLat,
  geometry: GeoJSON.LineString | null,
): GeoJSON.LineString | null {
  if (!geometry?.coordinates?.length) return null;
  const coords = geometry.coordinates as LonLat[];
  const idx = nearestRouteIndex(pos, coords);
  const rest = coords.slice(idx);
  if (!rest.length) return null;
  return {
    type: 'LineString',
    coordinates: [pos, ...rest],
  };
}

export function remainingMiles(
  pos: LonLat,
  geometry: GeoJSON.LineString | null,
  destination: LonLat | null,
): number {
  const rem = remainingRouteGeometry(pos, geometry);
  if (rem && rem.coordinates.length >= 2) {
    let sum = 0;
    for (let i = 1; i < rem.coordinates.length; i++) {
      sum += haversineMi(
        rem.coordinates[i - 1] as LonLat,
        rem.coordinates[i] as LonLat,
      );
    }
    return Math.round(sum * 10) / 10;
  }
  if (destination) return Math.round(haversineMi(pos, destination) * 10) / 10;
  return 0;
}

/** Rough ETA minutes assuming average chase drive speed. */
export function etaMinutes(remainingMi: number, avgMph = 45): number {
  if (remainingMi <= 0) return 0;
  return Math.max(1, Math.round((remainingMi / avgMph) * 60));
}
