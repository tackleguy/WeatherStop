// Hole geometry (yards + bearing) from OSM golf tags around a course.
// Fast path: hole centerlines only. Tee/green pairing only if needed.

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

/** Keep tee, green, and a few midpoints — enough for map draw, tiny payload. */
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

function holesFromWays(els: OsmElement[]): GolfHole[] {
  const holes: GolfHole[] = [];
  const usedRefs = new Set<number>();
  const holeWays = els.filter(
    (e) => e.type === 'way' && e.tags?.golf === 'hole' && e.geometry?.length,
  );

  for (const way of holeWays) {
    const geom = way.geometry!;
    if (geom.length < 2) continue;
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
  holes.sort((a, b) => a.number - b.number);
  return holes;
}

function holesFromTeeGreen(els: OsmElement[], existing: GolfHole[]): GolfHole[] {
  const holes = [...existing];
  const usedRefs = new Set(existing.map((h) => h.number));
  const tees = els.filter((e) => e.tags?.golf === 'tee');
  const greens = els.filter(
    (e) => e.tags?.golf === 'green' || e.tags?.golf === 'pin',
  );

  const teePts: Array<{
    ref: number | null;
    pt: { lat: number; lon: number };
    par?: number;
  }> = [];
  for (const t of tees) {
    const c = centerOf(t) ?? (t.geometry ? centroid(t.geometry) : null);
    if (!c) continue;
    teePts.push({
      ref: parseRef(t.tags),
      pt: c,
      par: t.tags?.par ? Number(t.tags.par) : undefined,
    });
  }
  const greenPts: Array<{
    ref: number | null;
    pt: { lat: number; lon: number };
  }> = [];
  for (const g of greens) {
    const c = centerOf(g) ?? (g.geometry ? centroid(g.geometry) : null);
    if (!c) continue;
    greenPts.push({ ref: parseRef(g.tags), pt: c });
  }

  for (const tee of teePts) {
    if (tee.ref != null && usedRefs.has(tee.ref)) continue;
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
  }
  holes.sort((a, b) => a.number - b.number);
  return holes;
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const rawLat = Number(searchParams.get('lat'));
  const rawLon = Number(searchParams.get('lon'));
  const radiusM = Math.min(
    Math.max(Number(searchParams.get('radius') ?? 800), 300),
    1800,
  );

  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLon)) {
    return errResponse('lat and lon required', 400);
  }

  const lat = quantizeCoord(rawLat, 4);
  const lon = quantizeCoord(rawLon, 4);

  // Fast path — hole centerlines alone cover most well-mapped courses.
  const holeQuery = `
[out:json][timeout:10];
way["golf"="hole"](around:${radiusM},${lat},${lon});
out geom;
`.trim();

  try {
    const raw = (await overpass(holeQuery, { timeoutMs: 10_000 })) as {
      elements?: OsmElement[];
    };
    let holes = holesFromWays(raw.elements ?? []);

    // Only pull tees/greens when the course is sparsely tagged.
    if (holes.length < 9) {
      const fallbackQuery = `
[out:json][timeout:10];
(
  node["golf"="tee"](around:${radiusM},${lat},${lon});
  way["golf"="tee"](around:${radiusM},${lat},${lon});
  node["golf"="green"](around:${radiusM},${lat},${lon});
  way["golf"="green"](around:${radiusM},${lat},${lon});
  node["golf"="pin"](around:${radiusM},${lat},${lon});
);
out center tags;
`.trim();
      const extra = (await overpass(fallbackQuery, { timeoutMs: 10_000 })) as {
        elements?: OsmElement[];
      };
      holes = holesFromTeeGreen(extra.elements ?? [], holes);
    }

    return jsonResponse(
      {
        holes,
        count: holes.length,
        attribution: '© OpenStreetMap contributors (ODbL)',
      },
      3600,
      604_800,
    );
  } catch (err) {
    return errResponse(err instanceof Error ? err.message : 'holes failed');
  }
}
