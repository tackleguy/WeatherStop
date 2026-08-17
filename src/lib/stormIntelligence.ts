import type { AlertRow } from './nwsAlerts';

export type StormDanger = 'extreme' | 'high' | 'moderate' | 'low';

export interface StormIntel {
  id: string;
  type: string;
  danger: StormDanger;
  source: 'NWS warning' | 'NHC forecast';
  center: [number, number];
  radiusKm: number;
  motionBearing?: number;
  motionMph?: number;
  description: string;
}

const DIRECTION_BEARINGS: Record<string, number> = {
  N: 0,
  NORTH: 0,
  NNE: 22.5,
  NE: 45,
  NORTHEAST: 45,
  ENE: 67.5,
  E: 90,
  EAST: 90,
  ESE: 112.5,
  SE: 135,
  SOUTHEAST: 135,
  SSE: 157.5,
  S: 180,
  SOUTH: 180,
  SSW: 202.5,
  SW: 225,
  SOUTHWEST: 225,
  WSW: 247.5,
  W: 270,
  WEST: 270,
  WNW: 292.5,
  NW: 315,
  NORTHWEST: 315,
  NNW: 337.5,
};

function coordinatesOf(geometry: GeoJSON.Geometry): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const walk = (value: unknown) => {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      points.push([value[0], value[1]]);
      return;
    }
    if (Array.isArray(value)) value.forEach(walk);
  };
  if ('coordinates' in geometry) walk(geometry.coordinates);
  return points;
}

function distanceKm(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const lat1 = a[1] * rad;
  const lat2 = b[1] * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function geometryCenter(
  geometry: GeoJSON.Geometry,
): { center: [number, number]; radiusKm: number } | null {
  const points = coordinatesOf(geometry);
  if (!points.length) return null;
  const center: [number, number] = [
    points.reduce((sum, p) => sum + p[0], 0) / points.length,
    points.reduce((sum, p) => sum + p[1], 0) / points.length,
  ];
  const radiusKm = Math.max(
    4,
    Math.min(80, Math.max(...points.map((p) => distanceKm(center, p)))),
  );
  return { center, radiusKm };
}

function parseMotion(text: string): {
  bearing?: number;
  mph?: number;
} {
  const match = text
    .toUpperCase()
    .match(
      /MOV(?:ING|EMENT)?\s+(?:TOWARD\s+THE\s+)?(NORTH(?:EAST|WEST)?|SOUTH(?:EAST|WEST)?|EAST|WEST|NNE|ENE|ESE|SSE|SSW|WSW|WNW|NNW|NE|SE|SW|NW|N|E|S|W)\s+(?:AT|AROUND)\s+(\d{1,3})\s*MPH/,
    );
  if (!match) return {};
  return {
    bearing: DIRECTION_BEARINGS[match[1]],
    mph: Number(match[2]),
  };
}

function dangerFor(alert: AlertRow): StormDanger {
  if (/tornado/i.test(alert.event)) return 'extreme';
  if (/severe thunderstorm|hurricane/i.test(alert.event)) return 'high';
  if (alert.severity === 'extreme') return 'extreme';
  if (alert.severity === 'severe') return 'high';
  if (alert.severity === 'moderate') return 'moderate';
  return 'low';
}

function typeFor(alert: AlertRow): string {
  if (/tornado/i.test(alert.event)) return 'Tornado warning';
  if (/severe thunderstorm/i.test(alert.event)) return 'Severe thunderstorm';
  if (/hurricane/i.test(alert.event)) return 'Hurricane hazard';
  if (/flash flood/i.test(alert.event)) return 'Flash-flood storm';
  return alert.event;
}

export function alertStorms(alerts: AlertRow[]): StormIntel[] {
  const storms: StormIntel[] = [];
  for (const alert of alerts) {
    if (
      !alert.geometry ||
      !/tornado|severe thunderstorm|hurricane|flash flood/i.test(alert.event)
    ) {
      continue;
    }
    const spatial = geometryCenter(alert.geometry);
    if (!spatial) continue;
    const motion = parseMotion(
      `${alert.headline}\n${alert.description}`,
    );
    storms.push({
      id: alert.id,
      type: typeFor(alert),
      danger: dangerFor(alert),
      source: 'NWS warning',
      center: spatial.center,
      radiusKm: spatial.radiusKm,
      motionBearing: motion.bearing,
      motionMph: motion.mph,
      description:
        motion.bearing != null && motion.mph != null
          ? `Moving ${Math.round(motion.bearing)}° at ${motion.mph} mph`
          : `${alert.certainty || 'Official'} · ${alert.urgency || 'active'}`,
    });
  }
  return storms;
}

export function destination(
  origin: [number, number],
  bearingDeg: number,
  distanceKmValue: number,
): [number, number] {
  const r = 6371;
  const angular = distanceKmValue / r;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin[1] * Math.PI) / 180;
  const lon1 = (origin[0] * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

export function circlePolygon(
  center: [number, number],
  radiusKm: number,
  steps = 64,
): GeoJSON.Polygon {
  const ring: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i += 1) {
    ring.push(destination(center, (i / steps) * 360, radiusKm));
  }
  return { type: 'Polygon', coordinates: [ring] };
}

export function stormOverlayGeoJSON(storms: StormIntel[]): {
  areas: GeoJSON.FeatureCollection;
  paths: GeoJSON.FeatureCollection;
  points: GeoJSON.FeatureCollection;
} {
  const areas: GeoJSON.Feature[] = [];
  const paths: GeoJSON.Feature[] = [];
  const points: GeoJSON.Feature[] = [];
  for (const storm of storms) {
    const properties = {
      id: storm.id,
      type: storm.type,
      danger: storm.danger,
      source: storm.source,
    };
    areas.push({
      type: 'Feature',
      properties,
      geometry: circlePolygon(storm.center, storm.radiusKm),
    });
    points.push({
      type: 'Feature',
      properties,
      geometry: { type: 'Point', coordinates: storm.center },
    });
    if (storm.motionBearing != null && storm.motionMph != null) {
      const kmPerHour = storm.motionMph * 1.60934;
      paths.push({
        type: 'Feature',
        properties: { ...properties, motionMph: storm.motionMph },
        geometry: {
          type: 'LineString',
          coordinates: [
            storm.center,
            destination(storm.center, storm.motionBearing, kmPerHour * 0.5),
            destination(storm.center, storm.motionBearing, kmPerHour),
          ],
        },
      });
    }
  }
  return {
    areas: { type: 'FeatureCollection', features: areas },
    paths: { type: 'FeatureCollection', features: paths },
    points: { type: 'FeatureCollection', features: points },
  };
}
