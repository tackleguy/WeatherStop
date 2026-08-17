// Nearby golf courses.
//
// Photon (komoot) reverse search with an OSM tag filter is the primary source:
// it answers in ~200–900 ms worldwide and returns the OSM id + extent we need
// to scope hole geometry. Overpass is the fallback — authoritative for tags
// like `holes`/`par`, but its public instances are frequently overloaded.

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

export interface GolfCourseSummary {
  id: string;
  osmType: 'way' | 'relation' | 'node';
  osmId: number;
  name: string;
  lat: number;
  lon: number;
  /** Course bounds as [south, west, north, east] when known. */
  bbox?: [number, number, number, number];
  holes?: number;
  par?: number;
  website?: string;
  distanceMi?: number;
}

const MI_PER_KM = 0.621371;

function haversineMi(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.7613;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const A =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(A));
}

interface PhotonFeature {
  properties?: {
    name?: string;
    osm_type?: string;
    osm_id?: number;
    website?: string;
    /** [minLon, maxLat, maxLon, minLat] */
    extent?: number[];
  };
  geometry?: { coordinates?: number[] };
}

function photonOsmType(t: string | undefined): 'way' | 'relation' | 'node' {
  if (t === 'W') return 'way';
  if (t === 'R') return 'relation';
  return 'node';
}

async function photonCourses(
  lat: number,
  lon: number,
  radiusM: number,
  limit: number,
  signal: AbortSignal,
): Promise<GolfCourseSummary[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius: String(Math.max(1, Math.round(radiusM / 1000))),
    limit: String(Math.min(limit * 2, 50)),
    lang: 'en',
  });
  params.append('osm_tag', 'leisure:golf_course');

  const res = await fetch(`https://photon.komoot.io/reverse?${params}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const gj = (await res.json()) as { features?: PhotonFeature[] };

  const radiusMi = (radiusM / 1000) * MI_PER_KM;
  const out: GolfCourseSummary[] = [];
  const seen = new Set<string>();
  for (const f of gj.features ?? []) {
    const coords = f.geometry?.coordinates;
    const p = f.properties;
    if (!coords || coords.length < 2 || !p) continue;
    const cLon = coords[0]!;
    const cLat = coords[1]!;
    if (!Number.isFinite(cLat) || !Number.isFinite(cLon)) continue;
    const distanceMi = haversineMi(lat, lon, cLat, cLon);
    // Photon's radius is a soft bias, so enforce the range ourselves.
    if (distanceMi > radiusMi * 1.2) continue;
    const osmType = photonOsmType(p.osm_type);
    const osmId = p.osm_id ?? 0;
    const id = `${osmType}/${osmId}`;
    if (!osmId || seen.has(id)) continue;
    seen.add(id);
    const e = p.extent;
    out.push({
      id,
      osmType,
      osmId,
      name: p.name?.trim() || 'Unnamed golf course',
      lat: cLat,
      lon: cLon,
      bbox:
        e && e.length === 4
          ? [
              Math.min(e[1]!, e[3]!),
              Math.min(e[0]!, e[2]!),
              Math.max(e[1]!, e[3]!),
              Math.max(e[0]!, e[2]!),
            ]
          : undefined,
      website: p.website,
      distanceMi,
    });
  }
  return out;
}

async function overpassCourses(
  lat: number,
  lon: number,
  originLat: number,
  originLon: number,
  radiusM: number,
): Promise<GolfCourseSummary[]> {
  const query = `
[out:json][timeout:25];
nwr["leisure"="golf_course"](around:${radiusM},${lat},${lon});
out center tags bb;
`.trim();

  const raw = (await overpass(query, { timeoutMs: 16_000 })) as {
    elements?: Array<
      OsmElement & {
        bounds?: {
          minlat: number;
          minlon: number;
          maxlat: number;
          maxlon: number;
        };
      }
    >;
  };

  const courses: GolfCourseSummary[] = [];
  for (const el of raw.elements ?? []) {
    const c = centerOf(el);
    if (!c) continue;
    const tags = el.tags ?? {};
    const holes = tags.holes ? Number(tags.holes) : undefined;
    const par = tags.par ? Number(tags.par) : undefined;
    const b = el.bounds;
    courses.push({
      id: `${el.type}/${el.id}`,
      osmType: el.type as 'way' | 'relation' | 'node',
      osmId: el.id,
      name: tags.name?.trim() || 'Unnamed golf course',
      lat: c.lat,
      lon: c.lon,
      bbox: b ? [b.minlat, b.minlon, b.maxlat, b.maxlon] : undefined,
      holes: Number.isFinite(holes) ? holes : undefined,
      par: Number.isFinite(par) ? par : undefined,
      website: tags.website || tags['contact:website'],
      distanceMi: haversineMi(originLat, originLon, c.lat, c.lon),
    });
  }
  return courses;
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const rawLat = Number(searchParams.get('lat'));
  const rawLon = Number(searchParams.get('lon'));
  const radiusM = Math.min(
    Math.max(Number(searchParams.get('radius') ?? 30_000), 2000),
    60_000,
  );
  const limit = Math.min(
    Math.max(Number(searchParams.get('limit') ?? 24), 1),
    40,
  );

  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLon)) {
    return errResponse('lat and lon required', 400);
  }

  const lat = quantizeCoord(rawLat, 3);
  const lon = quantizeCoord(rawLon, 3);
  const ac = new AbortController();
  const hardStop = setTimeout(() => ac.abort(), 8_000);
  const failures: string[] = [];

  const finish = (
    courses: GolfCourseSummary[],
    source: 'photon' | 'overpass',
  ) =>
    jsonResponse(
      {
        courses: courses
          .sort((a, b) => (a.distanceMi ?? 0) - (b.distanceMi ?? 0))
          .slice(0, limit),
        source,
        attribution: '© OpenStreetMap contributors (ODbL)',
      },
      1800,
      86_400,
    );

  try {
    const courses = await photonCourses(rawLat, rawLon, radiusM, limit, ac.signal);
    if (courses.length) return finish(courses, 'photon');
    failures.push('photon: no golf courses in range');
  } catch (err) {
    failures.push(err instanceof Error ? err.message : 'photon failed');
  } finally {
    clearTimeout(hardStop);
  }

  try {
    const courses = await overpassCourses(lat, lon, rawLat, rawLon, radiusM);
    // An empty Overpass answer here is trustworthy: nothing is mapped nearby.
    return finish(courses, 'overpass');
  } catch (err) {
    failures.push(err instanceof Error ? err.message : 'overpass failed');
  }

  // Never report "no courses" when the lookup itself failed — the client shows
  // a retry instead of telling the user their city has no golf.
  return errResponse(failures.join(' · '));
}
