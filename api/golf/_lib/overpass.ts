// Shared Overpass helpers for OSM golf course / hole geometry.
// Races several public mirrors so a slow/queued instance does not stall Golf.

const OVERPASS_URLS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export const UA =
  process.env.NWS_USER_AGENT ??
  'weather-stop/1.0 (golf; contact@example.com)';

/**
 * Hit mirrors in parallel; first 200 + JSON wins. Others are aborted.
 * OSM golf data rarely changes, so callers should set long Cache-Control.
 */
export async function overpass(
  query: string,
  opts?: { timeoutMs?: number },
): Promise<unknown> {
  const timeoutMs = opts?.timeoutMs ?? 14_000;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const errors: string[] = [];

  try {
    const winner = await Promise.any(
      OVERPASS_URLS.map(async (url) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': UA,
            Accept: 'application/json',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: ac.signal,
        });
        if (!res.ok) {
          const msg = `overpass ${res.status} @ ${new URL(url).host}`;
          errors.push(msg);
          throw new Error(msg);
        }
        const data = await res.json();
        // Cancel siblings as soon as one payload lands.
        ac.abort();
        return data;
      }),
    );
    return winner;
  } catch (err) {
    if (err instanceof AggregateError) {
      throw new Error(errors[0] ?? 'overpass failed on all mirrors');
    }
    throw err instanceof Error ? err : new Error('overpass failed');
  } finally {
    clearTimeout(timer);
  }
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

/** Quantize coords so nearby requests share CDN / memory cache keys. */
export function quantizeCoord(n: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function jsonResponse(
  body: unknown,
  maxAge = 3600,
  sMaxAge = 86_400,
): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      // Browser keeps a warm copy; Vercel CDN keeps a longer shared copy.
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=86400`,
      'CDN-Cache-Control': `public, s-maxage=${sMaxAge}, stale-while-revalidate=86400`,
      'Vercel-CDN-Cache-Control': `public, s-maxage=${sMaxAge}, stale-while-revalidate=86400`,
    },
  });
}

export function errResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
