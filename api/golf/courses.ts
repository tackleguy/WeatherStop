// Nearby golf courses — race Nominatim (fast POI search) vs Overpass OSM.

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
  holes?: number;
  par?: number;
  website?: string;
  distanceMi?: number;
}

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

interface NominatimItem {
  osm_type?: string;
  osm_id?: number;
  display_name?: string;
  name?: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  namedetails?: { name?: string };
}

function fromNominatim(
  items: NominatimItem[],
  originLat: number,
  originLon: number,
): GolfCourseSummary[] {
  const out: GolfCourseSummary[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const lat = Number(it.lat);
    const lon = Number(it.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    // Prefer leisure=golf_course; allow golf named places as soft matches.
    const isGolf =
      it.type === 'golf_course' ||
      it.class === 'leisure' ||
      /golf/i.test(it.display_name ?? '') ||
      /golf/i.test(it.name ?? '');
    if (!isGolf) continue;
    const osmType = (it.osm_type ?? 'node') as 'way' | 'relation' | 'node';
    const osmId = it.osm_id ?? 0;
    const id = osmId ? `${osmType}/${osmId}` : `nom/${lat.toFixed(5)},${lon.toFixed(5)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const name =
      it.namedetails?.name?.trim() ||
      it.name?.trim() ||
      (it.display_name ?? 'Golf course').split(',')[0]?.trim() ||
      'Golf course';
    out.push({
      id,
      osmType,
      osmId,
      name,
      lat,
      lon,
      distanceMi: haversineMi(originLat, originLon, lat, lon),
    });
  }
  return out;
}

async function nominatimCourses(
  lat: number,
  lon: number,
  radiusM: number,
  limit: number,
  signal: AbortSignal,
): Promise<GolfCourseSummary[]> {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const viewbox = [
    lon - dLon,
    lat + dLat,
    lon + dLon,
    lat - dLat,
  ]
    .map((n) => n.toFixed(5))
    .join(',');

  const params = new URLSearchParams({
    format: 'jsonv2',
    q: 'golf course',
    limit: String(Math.min(limit * 2, 40)),
    viewbox,
    bounded: '1',
    addressdetails: '0',
    namedetails: '1',
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
      },
      signal,
    },
  );
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const items = (await res.json()) as NominatimItem[];
  return fromNominatim(items, lat, lon);
}

async function overpassCourses(
  lat: number,
  lon: number,
  originLat: number,
  originLon: number,
  radiusM: number,
  signal: AbortSignal,
): Promise<GolfCourseSummary[]> {
  // Lightweight: tags + center only. Race mirrors with a hard deadline.
  const query = `
[out:json][timeout:8];
nwr["leisure"="golf_course"](around:${radiusM},${lat},${lon});
out center tags;
`.trim();

  // overpass() has its own abort; also honor outer signal.
  const data = await Promise.race([
    overpass(query, { timeoutMs: 8_000 }),
    new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), {
        once: true,
      });
    }),
  ]);

  const raw = data as { elements?: OsmElement[] };
  const courses: GolfCourseSummary[] = [];
  for (const el of raw.elements ?? []) {
    const c = centerOf(el);
    if (!c) continue;
    const tags = el.tags ?? {};
    const holes = tags.holes ? Number(tags.holes) : undefined;
    const par = tags.par ? Number(tags.par) : undefined;
    courses.push({
      id: `${el.type}/${el.id}`,
      osmType: el.type,
      osmId: el.id,
      name: tags.name?.trim() || 'Unnamed golf course',
      lat: c.lat,
      lon: c.lon,
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
    Math.max(Number(searchParams.get('radius') ?? 20000), 2000),
    50000,
  );
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 24), 1), 40);

  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLon)) {
    return errResponse('lat and lon required', 400);
  }

  const lat = quantizeCoord(rawLat, 3);
  const lon = quantizeCoord(rawLon, 3);
  const ac = new AbortController();
  const hardStop = setTimeout(() => ac.abort(), 9_000);

  try {
    // Prefer whichever source returns a usable list first.
    // Nominatim is usually 200–800ms; Overpass can be 1–8s depending on load.
    const settled = await Promise.any([
      nominatimCourses(rawLat, rawLon, radiusM, limit, ac.signal).then(
        (courses) => {
          if (!courses.length) throw new Error('nominatim empty');
          return { source: 'nominatim' as const, courses };
        },
      ),
      overpassCourses(lat, lon, rawLat, rawLon, radiusM, ac.signal).then(
        (courses) => {
          if (!courses.length) throw new Error('overpass empty');
          return { source: 'overpass' as const, courses };
        },
      ),
    ]);
    ac.abort();

    const courses = settled.courses
      .sort((a, b) => (a.distanceMi ?? 0) - (b.distanceMi ?? 0))
      .slice(0, limit);

    return jsonResponse(
      {
        courses,
        source: settled.source,
        attribution:
          settled.source === 'nominatim'
            ? '© OpenStreetMap / Nominatim'
            : '© OpenStreetMap contributors (ODbL)',
      },
      1800,
      86_400,
    );
  } catch {
    // Absolute last resort: fresh Overpass attempt (outer race may have aborted).
    try {
      const courses = (
        await overpassCourses(
          lat,
          lon,
          rawLat,
          rawLon,
          radiusM,
          new AbortController().signal,
        )
      )
        .sort((a, b) => (a.distanceMi ?? 0) - (b.distanceMi ?? 0))
        .slice(0, limit);
      return jsonResponse(
        {
          courses,
          source: 'overpass',
          attribution: '© OpenStreetMap contributors (ODbL)',
        },
        1800,
        86_400,
      );
    } catch (err) {
      return errResponse(
        err instanceof Error ? err.message : 'courses failed',
      );
    }
  } finally {
    clearTimeout(hardStop);
  }
}
