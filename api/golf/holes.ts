// Hole geometry (yards + bearing) from OSM golf tags.
//
// Strategy (fast → thorough):
//  1. golf=hole centerlines in the course bbox / radius
//  2. always merge golf=tee boxes onto those holes (front / mid / back)
//  3. wider radii, then OSM area(id) when the polygon is known
// Multiple ways with the same hole number become tee variants when greens
// sit near each other, or North/South (etc.) layouts when they do not.

import { bearingDeg, haversineYards, pathLengthYards } from './_lib/geo';
import {
  centerOf,
  errResponse,
  jsonResponse,
  overpass,
  quantizeCoord,
  UA,
  type OsmElement,
} from './_lib/overpass';

export const config = { runtime: 'edge' };

export type TeeKind = 'back' | 'mid' | 'front';

export interface GolfTeeBox {
  id: string;
  label: string;
  kind: TeeKind;
  color?: string;
  yards: number;
  bearingDeg: number;
  tee: { lat: number; lon: number };
  path?: Array<{ lat: number; lon: number }>;
  teeElevationM?: number;
}

export interface GolfHole {
  number: number;
  name?: string;
  par?: number;
  yards: number;
  /** Tee → green bearing, degrees true (0–360). */
  bearingDeg: number;
  tee: { lat: number; lon: number };
  green: { lat: number; lon: number };
  teeElevationM?: number;
  greenElevationM?: number;
  path?: Array<{ lat: number; lon: number }>;
  source: 'hole-way' | 'tee-green';
  loop?: string;
  tees?: GolfTeeBox[];
}

/** Process-local cache — hole geometry almost never changes. */
const HOLE_MEM = new Map<string, { at: number; holes: GolfHole[] }>();
const HOLE_MEM_TTL_MS = 6 * 60 * 60_000;

/** Add tee/green elevations in one request so plays-like can include slope. */
async function addElevations(holes: GolfHole[]): Promise<GolfHole[]> {
  if (!holes.length) return holes;
  const points: Array<{ lat: number; lon: number }> = [];
  const jobs: Array<{ hole: number; teeIdx: number | 'green' }> = [];
  holes.forEach((hole, holeIdx) => {
    const tees = hole.tees?.length
      ? hole.tees
      : [{ tee: hole.tee } as GolfTeeBox];
    tees.forEach((t, teeIdx) => {
      points.push(t.tee);
      jobs.push({ hole: holeIdx, teeIdx });
    });
    points.push(hole.green);
    jobs.push({ hole: holeIdx, teeIdx: 'green' });
  });
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat.toFixed(6)).join(','),
    longitude: points.map((p) => p.lon.toFixed(6)).join(','),
  });
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?${params}`,
    );
    if (!res.ok) return holes;
    const body = (await res.json()) as { elevation?: Array<number | null> };
    const elevations = body.elevation ?? [];
    const next = holes.map((h) => ({
      ...h,
      tees: h.tees ? h.tees.map((t) => ({ ...t })) : undefined,
    }));
    jobs.forEach((job, i) => {
      const elev = elevations[i];
      if (typeof elev !== 'number' || !Number.isFinite(elev)) return;
      const hole = next[job.hole]!;
      if (job.teeIdx === 'green') {
        hole.greenElevationM = elev;
        return;
      }
      if (hole.tees?.[job.teeIdx]) {
        hole.tees[job.teeIdx]!.teeElevationM = elev;
      }
      if (job.teeIdx === 0) hole.teeElevationM = elev;
    });
    return next.map((hole) => {
      const mid =
        hole.tees?.find((t) => t.kind === 'mid') ??
        hole.tees?.[Math.floor((hole.tees.length - 1) / 2)] ??
        null;
      if (!mid) return hole;
      return {
        ...hole,
        yards: mid.yards,
        bearingDeg: mid.bearingDeg,
        tee: mid.tee,
        path: mid.path,
        teeElevationM: mid.teeElevationM,
      };
    });
  } catch {
    return holes;
  }
}

function parseRef(
  tags: Record<string, string | undefined> | undefined,
): number | null {
  const raw = tags?.ref ?? tags?.hole ?? tags?.name;
  if (!raw) return null;
  const m = String(raw).match(/(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 36 ? n : null;
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

function pointInPolygon(
  point: { lat: number; lon: number },
  polygon: Array<{ lat: number; lon: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const crosses =
      a.lat > point.lat !== b.lat > point.lat &&
      point.lon <
        ((b.lon - a.lon) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lon;
    if (crosses) inside = !inside;
  }
  return inside;
}

function titleCase(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function loopFromTags(
  tags: Record<string, string | undefined> | undefined,
): string {
  const raw = (
    tags?.['golf:course'] ??
    tags?.course ??
    tags?.['golf:layout'] ??
    ''
  ).trim();
  return raw ? titleCase(raw) : '';
}

function colorFromTags(
  tags: Record<string, string | undefined> | undefined,
): string | undefined {
  const raw = (tags?.colour ?? tags?.color ?? '').trim().toLowerCase();
  return raw || undefined;
}

function labelFromTags(
  tags: Record<string, string | undefined> | undefined,
): string {
  const color = colorFromTags(tags);
  if (color) return titleCase(color);
  const tee = (tags?.tee ?? tags?.['golf:tee'] ?? '').trim();
  if (tee && !/^\d+$/.test(tee)) return titleCase(tee);
  const name = (tags?.name ?? '')
    .replace(/\btee(s| box)?\b/gi, '')
    .replace(/\bhole\s*\d+\b/gi, '')
    .trim();
  if (name && !/^\d+$/.test(name) && name.length < 28) return titleCase(name);
  return '';
}

function kindFromYardage(
  yards: number,
  all: number[],
): TeeKind {
  if (all.length <= 1) return 'mid';
  const sorted = [...all].sort((a, b) => a - b);
  const shortest = sorted[0]!;
  const longest = sorted[sorted.length - 1]!;
  if (yards === longest && longest > shortest + 8) return 'back';
  if (yards === shortest && longest > shortest + 8) return 'front';
  return 'mid';
}

function applyTeeKinds(tees: GolfTeeBox[]): GolfTeeBox[] {
  const yards = tees.map((t) => t.yards);
  return tees
    .map((t) => ({
      ...t,
      kind: kindFromYardage(t.yards, yards),
      label:
        t.label ||
        (kindFromYardage(t.yards, yards) === 'back'
          ? 'Back'
          : kindFromYardage(t.yards, yards) === 'front'
            ? 'Front'
            : 'Middle'),
    }))
    .sort((a, b) => b.yards - a.yards);
}

function upsertTee(
  holes: GolfHole[],
  input: {
    number: number;
    loop: string;
    label: string;
    color?: string;
    yards: number;
    bearingDeg: number;
    tee: { lat: number; lon: number };
    green: { lat: number; lon: number };
    path?: Array<{ lat: number; lon: number }>;
    par?: number;
    name?: string;
    source: 'hole-way' | 'tee-green';
  },
): void {
  const same = holes.find(
    (h) =>
      h.number === input.number &&
      haversineYards(h.green.lat, h.green.lon, input.green.lat, input.green.lon) <
        90,
  );
  const box: GolfTeeBox = {
    id: `${input.tee.lat.toFixed(5)},${input.tee.lon.toFixed(5)}`,
    label: input.label,
    kind: 'mid',
    color: input.color,
    yards: input.yards,
    bearingDeg: input.bearingDeg,
    tee: input.tee,
    path: input.path,
  };
  if (same) {
    const tees = same.tees ?? [];
    if (
      tees.some(
        (t) => haversineYards(t.tee.lat, t.tee.lon, input.tee.lat, input.tee.lon) < 12,
      )
    ) {
      return;
    }
    same.tees = applyTeeKinds([...tees, box]);
    const mid =
      same.tees.find((t) => t.kind === 'mid') ??
      same.tees[Math.floor((same.tees.length - 1) / 2)]!;
    same.yards = mid.yards;
    same.bearingDeg = mid.bearingDeg;
    same.tee = mid.tee;
    same.path = mid.path;
    if (input.par && !same.par) same.par = input.par;
    if (input.name && !same.name) same.name = input.name;
    if (input.loop && !same.loop) same.loop = input.loop;
    return;
  }
  holes.push({
    number: input.number,
    name: input.name,
    par: input.par,
    yards: input.yards,
    bearingDeg: input.bearingDeg,
    tee: input.tee,
    green: input.green,
    path: input.path,
    source: input.source,
    loop: input.loop || undefined,
    tees: applyTeeKinds([box]),
  });
}

const MAX_HOLES = 54;

function autoLoops(holes: GolfHole[]): GolfHole[] {
  const withNums = holes.map((h) => {
    if (h.loop || h.number <= 18) return h;
    if (h.number <= 36) {
      return { ...h, loop: 'Second course', number: h.number - 18 };
    }
    return h;
  });
  const firsts = withNums.filter((h) => h.number === 1);
  const unlabeled = firsts.filter((h) => !h.loop);
  if (unlabeled.length < 2) return withNums;
  const lats = unlabeled.map((h) => h.green.lat);
  const lons = unlabeled.map((h) => h.green.lon);
  const dLat = Math.max(...lats) - Math.min(...lats);
  const dLon = Math.max(...lons) - Math.min(...lons);
  const meanLat = lats.reduce((s, n) => s + n, 0) / lats.length;
  const meanLon = lons.reduce((s, n) => s + n, 0) / lons.length;
  const ns = dLat >= dLon;
  return withNums.map((h) => {
    if (h.loop) return h;
    if (ns) return { ...h, loop: h.green.lat >= meanLat ? 'North' : 'South' };
    return { ...h, loop: h.green.lon >= meanLon ? 'East' : 'West' };
  });
}

function finalizeHoles(holes: GolfHole[]): GolfHole[] {
  const next = autoLoops(holes);
  next.sort((a, b) => {
    const loop = (a.loop ?? '').localeCompare(b.loop ?? '');
    if (loop) return loop;
    return a.number - b.number;
  });
  return next.slice(0, MAX_HOLES);
}

function holesFromWays(els: OsmElement[]): GolfHole[] {
  const holes: GolfHole[] = [];

  for (const way of els) {
    if (way.type !== 'way' || way.tags?.golf !== 'hole') continue;
    const geom = way.geometry;
    if (!geom || geom.length < 2) continue;
    let num = parseRef(way.tags);
    if (num == null) continue;
    const tee = geom[0]!;
    const green = geom[geom.length - 1]!;
    const yards = Math.round(pathLengthYards(geom));
    if (yards < 40 || yards > 750) continue;
    upsertTee(holes, {
      number: num,
      loop: loopFromTags(way.tags),
      label: labelFromTags(way.tags),
      color: colorFromTags(way.tags),
      yards,
      bearingDeg: Math.round(bearingDeg(tee.lat, tee.lon, green.lat, green.lon)),
      tee: { lat: tee.lat, lon: tee.lon },
      green: { lat: green.lat, lon: green.lon },
      path: slimPath(geom),
      par: way.tags?.par ? Number(way.tags.par) : undefined,
      name: way.tags?.name,
      source: 'hole-way',
    });
  }

  return holes;
}

function holesFromTeeGreen(
  els: OsmElement[],
  existing: GolfHole[],
): GolfHole[] {
  const holes = existing.map((h) => ({
    ...h,
    tees: h.tees ? [...h.tees] : undefined,
  }));

  const teePts: Array<{
    ref: number | null;
    pt: { lat: number; lon: number };
    par?: number;
    loop: string;
    label: string;
    color?: string;
    name?: string;
  }> = [];
  const greenPts: Array<{
    ref: number | null;
    pt: { lat: number; lon: number };
    loop: string;
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
          loop: loopFromTags(el.tags),
          label: labelFromTags(el.tags),
          color: colorFromTags(el.tags),
          name: el.tags?.name,
        });
      }
    } else if (golf === 'green' || golf === 'pin') {
      const pt = pointOf(el);
      if (pt) {
        greenPts.push({
          ref: parseRef(el.tags),
          pt,
          loop: loopFromTags(el.tags),
        });
      }
    }
  }

  for (const tee of teePts) {
    let best: { pt: { lat: number; lon: number }; d: number } | null = null;
    for (const g of greenPts) {
      if (tee.ref != null && g.ref != null && tee.ref !== g.ref) continue;
      if (tee.loop && g.loop && tee.loop !== g.loop) continue;
      const d = haversineYards(tee.pt.lat, tee.pt.lon, g.pt.lat, g.pt.lon);
      if (d < 45 || d > 720) continue;
      if (!best || d < best.d) best = { pt: g.pt, d };
    }
    if (!best && tee.ref == null) {
      for (const g of greenPts) {
        const d = haversineYards(tee.pt.lat, tee.pt.lon, g.pt.lat, g.pt.lon);
        if (d < 70 || d > 680) continue;
        if (!best || d < best.d) best = { pt: g.pt, d };
      }
    }
    if (!best) continue;
    const green = best.pt;

    let num = tee.ref;
    let loop = tee.loop;
    if (num == null) {
      const near = holes.find(
        (h) =>
          haversineYards(h.green.lat, h.green.lon, green.lat, green.lon) < 90,
      );
      if (near) {
        num = near.number;
        loop = loop || near.loop || '';
      } else if (holes.length >= 18) {
        continue;
      } else {
        num = holes.length + 1;
      }
    }

    upsertTee(holes, {
      number: num,
      loop,
      label: tee.label,
      color: tee.color,
      yards: Math.round(best.d),
      bearingDeg: Math.round(
        bearingDeg(tee.pt.lat, tee.pt.lon, green.lat, green.lon),
      ),
      tee: tee.pt,
      green,
      path: [tee.pt, best.pt],
      par: tee.par,
      name: tee.name,
      source: 'tee-green',
    });
  }

  return holes;
}

async function queryWays(scope: string): Promise<OsmElement[]> {
  const query = `
[out:json][timeout:18];
way["golf"="hole"](${scope});
out geom;
`.trim();
  const raw = (await overpass(query, {
    timeoutMs: 12_000,
    hedgeMs: 1_800,
  })) as { elements?: OsmElement[] };
  return raw.elements ?? [];
}

async function queryTeeGreen(scope: string): Promise<OsmElement[]> {
  // Centers only — much cheaper than full geom for polygon greens.
  const query = `
[out:json][timeout:18];
(
  nwr["golf"="tee"](${scope});
  nwr["golf"="green"](${scope});
  nwr["golf"="pin"](${scope});
);
out center tags;
`.trim();
  const raw = (await overpass(query, {
    timeoutMs: 12_000,
    hedgeMs: 1_800,
  })) as { elements?: OsmElement[] };
  return raw.elements ?? [];
}

async function holesInScope(scope: string): Promise<GolfHole[]> {
  let holes = holesFromWays(await queryWays(scope));
  try {
    holes = holesFromTeeGreen(await queryTeeGreen(scope), holes);
  } catch {
    // Keep whatever centerlines we already have.
  }
  return finalizeHoles(holes);
}

/**
 * Read a small course bbox from OSM's main map API. This avoids overloaded
 * Overpass entirely for local courses while still using authoritative OSM
 * geometry. The endpoint returns nodes + ways, so reconstruct way geometry.
 */
async function holesFromOsmMap(
  bbox: string,
  osmType?: string | null,
  osmId?: number,
): Promise<GolfHole[] | null> {
  const [south, west, north, east] = bbox.split(',').map(Number);
  if (
    ![south, west, north, east].every(Number.isFinite) ||
    north! <= south! ||
    east! <= west!
  ) {
    return null;
  }
  // OSM map API accepts west,south,east,north and rejects very large boxes.
  if ((north! - south!) * (east! - west!) > 0.12) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12_000);
  try {
    const res = await fetch(
      `https://api.openstreetmap.org/api/0.6/map.json?bbox=${west},${south},${east},${north}`,
      {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: ac.signal,
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      elements?: Array<{
        type: 'node' | 'way' | 'relation';
        id: number;
        lat?: number;
        lon?: number;
        nodes?: number[];
        tags?: Record<string, string>;
        members?: Array<{
          type: 'node' | 'way' | 'relation';
          ref: number;
          role?: string;
        }>;
      }>;
    };
    const raw = body.elements ?? [];
    const nodeById = new Map<number, { lat: number; lon: number }>();
    for (const el of raw) {
      if (
        el.type === 'node' &&
        typeof el.lat === 'number' &&
        typeof el.lon === 'number'
      ) {
        nodeById.set(el.id, { lat: el.lat, lon: el.lon });
      }
    }

    const elements: OsmElement[] = [];
    for (const el of raw) {
      if (el.type === 'node') {
        if (typeof el.lat !== 'number' || typeof el.lon !== 'number') continue;
        elements.push({
          type: 'node' as const,
          id: el.id,
          lat: el.lat,
          lon: el.lon,
          tags: el.tags,
        });
        continue;
      }
      if (el.type !== 'way') continue;
      const geometry = (el.nodes ?? [])
        .map((id) => nodeById.get(id))
        .filter((point): point is { lat: number; lon: number } => Boolean(point));
      elements.push({
        type: 'way' as const,
        id: el.id,
        nodes: el.nodes,
        tags: el.tags,
        geometry,
      });
    }

    let scoped = elements;
    if (osmType === 'way' && Number.isFinite(osmId)) {
      const boundary = elements.find(
        (el) => el.type === 'way' && el.id === osmId,
      )?.geometry;
      if (!boundary || boundary.length < 3) return null;
      scoped = elements.filter((el) => {
        if (!el.tags?.golf) return false;
        const point = pointOf(el);
        return point ? pointInPolygon(point, boundary) : false;
      });
    } else if (osmType === 'relation' && Number.isFinite(osmId)) {
      const relation = raw.find(
        (el) => el.type === 'relation' && el.id === osmId,
      );
      const outerIds = new Set(
        (relation?.members ?? [])
          .filter(
            (member) =>
              member.type === 'way' &&
              (!member.role || member.role === 'outer'),
          )
          .map((member) => member.ref),
      );
      // Most golf multipolygons have one or more closed outer member ways.
      // Split outer rings fall back to the precise Overpass area query.
      const boundaries = elements
        .filter(
          (el) =>
            el.type === 'way' &&
            outerIds.has(el.id) &&
            (el.geometry?.length ?? 0) >= 4,
        )
        .map((el) => el.geometry!)
        .filter((ring) => {
          const first = ring[0]!;
          const last = ring[ring.length - 1]!;
          return first.lat === last.lat && first.lon === last.lon;
        });
      if (!boundaries.length) return null;
      scoped = elements.filter((el) => {
        if (!el.tags?.golf) return false;
        const point = pointOf(el);
        return point
          ? boundaries.some((boundary) => pointInPolygon(point, boundary))
          : false;
      });
    }

    // Always merge tee boxes onto centerlines so front / mid / back survive.
    let holes = holesFromWays(scoped);
    holes = holesFromTeeGreen(scoped, holes);
    return finalizeHoles(holes);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Parse `bbox=south,west,north,east`, padded to catch edge tees. */
function parseBbox(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [s, w, n, e] = parts as [number, number, number, number];
  if (n <= s || e <= w) return null;
  const pad = 0.003; // ~330 m — large enough for sprawling layouts
  return [
    quantizeCoord(s - pad, 4),
    quantizeCoord(w - pad, 4),
    quantizeCoord(n + pad, 4),
    quantizeCoord(e + pad, 4),
  ].join(',');
}

function aroundScope(lat: number, lon: number, radiusM: number): string {
  return `around:${radiusM},${lat},${lon}`;
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const rawLat = Number(searchParams.get('lat'));
  const rawLon = Number(searchParams.get('lon'));
  const bbox = parseBbox(searchParams.get('bbox'));
  const osmType = searchParams.get('osmType');
  const osmId = Number(searchParams.get('osmId'));
  const radiusM = Math.min(
    Math.max(Number(searchParams.get('radius') ?? 1800), 500),
    4000,
  );

  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLon)) {
    return errResponse('lat and lon required', 400);
  }

  const lat = quantizeCoord(rawLat, 4);
  const lon = quantizeCoord(rawLon, 4);
  const cacheKey = `h2:${lat}:${lon}:${bbox ?? ''}:${osmType ?? ''}${Number.isFinite(osmId) ? osmId : ''}:${radiusM}`;
  const cached = HOLE_MEM.get(cacheKey);
  if (cached && Date.now() - cached.at < HOLE_MEM_TTL_MS && cached.holes.length) {
    return jsonResponse(
      {
        holes: cached.holes,
        count: cached.holes.length,
        scope: 'cache',
        attribution: '© OpenStreetMap contributors (ODbL)',
      },
      3600,
      604_800,
    );
  }

  type Scope = { name: string; queryScope: string };
  const scopes: Scope[] = [];

  if (
    (osmType === 'way' || osmType === 'relation') &&
    Number.isFinite(osmId)
  ) {
    // Resolved later via map_to_area — stored as a special marker.
    scopes.push({
      name: 'course-area',
      queryScope: `area:${osmType}:${osmId}`,
    });
  }
  if (bbox) scopes.push({ name: 'course-bbox', queryScope: bbox });
  // Escalating radii cover municipal parks and country clubs that span a mile+.
  for (const r of Array.from(
    new Set([radiusM, Math.max(radiusM, 2200), Math.max(radiusM, 3200)]),
  ).sort((a, b) => a - b)) {
    scopes.push({
      name: `radius-${r}`,
      queryScope: aroundScope(lat, lon, r),
    });
  }

  let lastError: string | null = null;
  let best: { holes: GolfHole[]; scope: string } = { holes: [], scope: 'none' };

  // Local munis and small country clubs often fail on public Overpass despite
  // having complete OSM geometry. The main map API is fast for a course bbox.
  if (bbox) {
    const mapHoles = await holesFromOsmMap(bbox, osmType, osmId);
    if (mapHoles !== null) {
      // A successful map response is authoritative for this bbox. If it has
      // no golf geometry, Overpass cannot invent it; return quickly and label
      // the course as unmapped instead of retrying for a minute.
      if (!mapHoles.length) {
        return jsonResponse(
          {
            holes: [],
            count: 0,
            scope: 'osm-map-unmapped',
            attribution: '© OpenStreetMap contributors (ODbL)',
          },
          600,
          3600,
        );
      }
      const holesWithElevation = await addElevations(mapHoles);
      HOLE_MEM.set(cacheKey, { at: Date.now(), holes: holesWithElevation });
      return jsonResponse(
        {
          holes: holesWithElevation,
          count: holesWithElevation.length,
          scope: 'osm-map',
          attribution: '© OpenStreetMap contributors (ODbL)',
        },
        3600,
        604_800,
      );
    }
  }

  for (const scope of scopes) {
    if (best.holes.length >= 18) break;
    try {
      let holes: GolfHole[];
      if (scope.queryScope.startsWith('area:')) {
        const [, type, id] = scope.queryScope.split(':');
        const areaQuery = `
[out:json][timeout:20];
${type === 'way' ? 'way' : 'rel'}(id:${id});
map_to_area->.course;
way["golf"="hole"](area.course);
out geom;
`.trim();
        const ways = (await overpass(areaQuery, {
          timeoutMs: 14_000,
          hedgeMs: 2_000,
        })) as { elements?: OsmElement[] };
        holes = holesFromWays(ways.elements ?? []);
        const tgQuery = `
[out:json][timeout:20];
${type === 'way' ? 'way' : 'rel'}(id:${id});
map_to_area->.course;
(
  nwr["golf"="tee"](area.course);
  nwr["golf"="green"](area.course);
  nwr["golf"="pin"](area.course);
);
out center tags;
`.trim();
        try {
          const tg = (await overpass(tgQuery, {
            timeoutMs: 12_000,
            hedgeMs: 1_800,
          })) as { elements?: OsmElement[] };
          holes = holesFromTeeGreen(tg.elements ?? [], holes);
        } catch {
          // keep centerlines
        }
        holes = finalizeHoles(holes);
      } else {
        holes = await holesInScope(scope.queryScope);
      }

      if (holes.length > best.holes.length) {
        best = { holes, scope: scope.name };
      }
      // Good enough — stop burning Overpass quota.
      if (holes.length >= 18) break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'overpass failed';
    }
  }

  if (!best.holes.length) {
    // Only error when every attempt failed — an empty OSM map stays 200.
    if (lastError) return errResponse(lastError);
    return jsonResponse(
      {
        holes: [],
        count: 0,
        scope: 'none',
        attribution: '© OpenStreetMap contributors (ODbL)',
      },
      600,
      3600,
    );
  }

  const holesWithElevation = await addElevations(best.holes);
  HOLE_MEM.set(cacheKey, { at: Date.now(), holes: holesWithElevation });

  return jsonResponse(
    {
      holes: holesWithElevation,
      count: holesWithElevation.length,
      scope: best.scope,
      attribution: '© OpenStreetMap contributors (ODbL)',
    },
    3600,
    604_800,
  );
}
