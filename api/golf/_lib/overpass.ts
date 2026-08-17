// Shared Overpass helpers for OSM golf course / hole geometry.

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export const UA =
  process.env.NWS_USER_AGENT ??
  'weather-stop/1.0 (golf; contact@example.com)';

export async function overpass(query: string): Promise<unknown> {
  let lastErr = 'overpass failed';
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': UA,
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        lastErr = `overpass ${res.status}`;
        continue;
      }
      return await res.json();
    } catch (err) {
      lastErr = err instanceof Error ? err.message : 'overpass network error';
    }
  }
  throw new Error(lastErr);
}

export interface OsmTags {
  [k: string]: string | undefined;
}

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
  nodes?: number[];
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{
    type: string;
    ref: number;
    role: string;
    lat?: number;
    lon?: number;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
}

export function centerOf(el: OsmElement): { lat: number; lon: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') {
    return { lat: el.lat, lon: el.lon };
  }
  if (el.center) return el.center;
  const geom = el.geometry;
  if (geom && geom.length) {
    let lat = 0;
    let lon = 0;
    for (const p of geom) {
      lat += p.lat;
      lon += p.lon;
    }
    return { lat: lat / geom.length, lon: lon / geom.length };
  }
  return null;
}

export function jsonResponse(body: unknown, maxAge = 600): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
    },
  });
}

export function errResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
