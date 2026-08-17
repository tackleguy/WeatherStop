// Hole geometry (yards + bearing) from OSM golf tags.
//
// Preferred path: bind to the course polygon via its OSM id, so we get that
// course's holes and never a neighbour's. Falls back to a radius search for
// courses mapped as a bare node or with a broken polygon.

import { bearingDeg, haversineYards, pathLengthYards } from './_lib/geo';
import {
  centerOf,
  errResponse,
  jsonResponse,
  overpass,
  quantizeCoord,
  type OsmElement,
} from './_lib/overpass';

export const config = { runtime: 'edge' };

export interface GolfHole {
  number: number;
  name?: string;
  par?: number;
  yards: number;
  /** Tee → green bearing, degrees true (0–360). */
  bearingDeg: number;
  tee: { lat: number; lon: number };
  green: { lat: number; lon: number };
  path?: Array<{ lat: number; lon: number }>;
  source: 'hole-way' | 'tee-green';
}

function parseRef(
  tags: Record<string, string | undefined> | undefined,
): number | null {
  const raw = tags?.ref ?? tags?.hole ?? tags?.name;
  if (!raw) return null;
  const m = String(raw).match(/(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 27 ? n : null;
}

function centroid(
  pts: Array<{ lat: number; lon: number }>,
): { lat: number; lon: number } {
  let lat = 0;
  let lon = 0;
  for (const p of pts) {
    lat += p.lat;
    lon += p.lon;
  }
  return { lat: lat / pts.length, lon: lon / pts.length };
}

/** Keep tee, green, and a few midpoints — enough to draw, tiny payload. */
function slimPath(
  geom: Array<{ lat: number; lon: number }>,
  maxPts = 8,
): Array<{ lat: number; lon: number }> {
  if (geom.length <= maxPts) return geom;
  const out: Array<{ lat: number; lon: number }> = [geom[0]!];
  const step = (geom.length - 1) / (maxPts - 1);
  for (let i = 1; i < maxPts - 1; i += 1) {
    out.push(geom[Math.round(i * step)]!);
  }
  out.push(geom[geom.length - 1]!);
  return out;
}

function pointOf(el: OsmElement): { lat: number; lon: number } | null {
  return centerOf(el) ?? (el.geometry?.length ? centroid(el.geometry) : null);
}

const MAX_HOLES = 27;

function buildHoles(els: OsmElement[]): GolfHole[] {
  const holes: GolfHole[] = [];
  const usedRefs = new Set<number>();

  // 1. golf=hole centerlines carry both length and direction.
  for (const way of els) {
    if (way.type !== 'way' || way.tags?.golf !== 'hole') continue;
    const geom = way.geometry;
    if (!geom || geom.length < 2) continue;
    const num = parseRef(way.tags) ?? holes.length + 1;
    if (usedRefs.has(num)) continue;
    const tee = geom[0]!;
    const green = geom[geom.length - 1]!;
    const yards = Math.round(pathLengthYards(geom));
    if (yards < 40 || yards > 750) continue;
    holes.push({
      number: num,
      name: way.tags?.name,
      par: way.tags?.par ? Number(way.tags.par) : undefined,
      yards,
      bearingDeg: Math.round(
        bearingDeg(tee.lat, tee.lon, green.lat, green.lon),
      ),
      tee: { lat: tee.lat, lon: tee.lon },
      green: { lat: green.lat, lon: green.lon },
      path: slimPath(geom),
      source: 'hole-way',
    });
    usedRefs.add(num);
  }

  // A full set of centerlines is authoritative — pairing loose tees on top of
  // it just invents duplicate holes (multiple tee boxes per hole).
  if (holes.length >= 9) {
    holes.sort((a, b) => a.number - b.number);
    return holes.slice(0, MAX_HOLES);
  }

  // 2. Pair tees to greens for courses without centerlines.
  const teePts: Array<{
    ref: number | null;
    pt: { lat: number; lon: number };
    par?: number;
  }> = [];
  const greenPts: Array<{
    ref: number | null;
    pt: { lat: number; lon: number };
  }> = [];
  for (const el of els) {
    const golf = el.tags?.golf;
    if (golf === 'tee') {
      const pt = pointOf(el);
      if (pt) {
        teePts.push({
          ref: parseRef(el.tags),
          pt,
          par: el.tags?.par ? Number(el.tags.par) : undefined,
        });
      }
    } else if (golf === 'green' || golf === 'pin') {
      const pt = pointOf(el);
      if (pt) greenPts.push({ ref: parseRef(el.tags), pt });
    }
  }

  // Courses tag several tee boxes per hole; keep one per playing corridor.
  const claimedTees: Array<{ lat: number; lon: number }> = holes.map(
    (h) => h.tee,
  );

  for (const tee of teePts) {
    if (tee.ref != null && usedRefs.has(tee.ref)) continue;
    if (
      claimedTees.some(
        (t) => haversineYards(t.lat, t.lon, tee.pt.lat, tee.pt.lon) < 60,
      )
    ) {
      continue;
    }
    let best: { pt: { lat: number; lon: number }; d: number } | null = null;
    for (const g of greenPts) {
      if (tee.ref != null && g.ref != null && tee.ref !== g.ref) continue;
      const d = haversineYards(tee.pt.lat, tee.pt.lon, g.pt.lat, g.pt.lon);
      if (d < 50 || d > 700) continue;
      if (!best || d < best.d) best = { pt: g.pt, d };
    }
    if (!best && tee.ref == null) {
      for (const g of greenPts) {
        const d = haversineYards(tee.pt.lat, tee.pt.lon, g.pt.lat, g.pt.lon);
        if (d < 80 || d > 650) continue;
        if (!best || d < best.d) best = { pt: g.pt, d };
      }
    }
    if (!best) continue;
    const num = tee.ref ?? holes.length + 1;
    if (usedRefs.has(num)) continue;
    holes.push({
      number: num,
      par: tee.par,
      yards: Math.round(best.d),
      bearingDeg: Math.round(
        bearingDeg(tee.pt.lat, tee.pt.lon, best.pt.lat, best.pt.lon),
      ),
      tee: tee.pt,
      green: best.pt,
      path: [tee.pt, best.pt],
      source: 'tee-green',
    });
    usedRefs.add(num);
    claimedTees.push(tee.pt);
    if (holes.length >= MAX_HOLES) break;
  }

  holes.sort((a, b) => a.number - b.number);
  return holes.slice(0, MAX_HOLES);
}

const GOLF_FEATURES = (scope: string) => `
(
  way["golf"="hole"](${scope});
  nwr["golf"="tee"](${scope});
  nwr["golf"="green"](${scope});
  nwr["golf"="pin"](${scope});
);
out body geom;
`.trim();

/** Parse `bbox=south,west,north,east`, padded slightly to catch edge tees. */
function parseBbox(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [s, w, n, e] = parts as [number, number, number, number];
  if (n <= s || e <= w) return null;
  const pad = 0.0015; // ~165 m
  return [
    quantizeCoord(s - pad, 4),
    quantizeCoord(w - pad, 4),
    quantizeCoord(n + pad, 4),
    quantizeCoord(e + pad, 4),
  ].join(',');
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const rawLat = Number(searchParams.get('lat'));
  const rawLon = Number(searchParams.get('lon'));
  const bbox = parseBbox(searchParams.get('bbox'));
  // Big country clubs span well over a mile; keep the default generous.
  const radiusM = Math.min(
    Math.max(Number(searchParams.get('radius') ?? 1600), 400),
    3000,
  );

  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLon)) {
    return errResponse('lat and lon required', 400);
  }

  const lat = quantizeCoord(rawLat, 4);
  const lon = quantizeCoord(rawLon, 4);

  // Course bounds beat a radius: they cover sprawling layouts without pulling
  // in the neighbouring course's holes.
  const scopes: Array<{ name: 'course-bbox' | 'radius'; query: string }> = [];
  if (bbox) {
    scopes.push({
      name: 'course-bbox',
      query: `[out:json][timeout:25];\n${GOLF_FEATURES(bbox)}`,
    });
  }
  scopes.push({
    name: 'radius',
    query: `[out:json][timeout:25];\n${GOLF_FEATURES(`around:${radiusM},${lat},${lon}`)}`,
  });

  let lastError: string | null = null;

  for (const scope of scopes) {
    try {
      const raw = (await overpass(scope.query, { timeoutMs: 16_000 })) as {
        elements?: OsmElement[];
      };
      const holes = buildHoles(raw.elements ?? []);
      if (!holes.length && scope !== scopes[scopes.length - 1]) continue;
      return jsonResponse(
        {
          holes,
          count: holes.length,
          scope: scope.name,
          attribution: '© OpenStreetMap contributors (ODbL)',
        },
        3600,
        604_800,
      );
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'overpass failed';
    }
  }

  return errResponse(lastError ?? 'hole lookup failed');
}
