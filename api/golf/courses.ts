// Nearby golf courses from OpenStreetMap (Overpass).

import {
  centerOf,
  errResponse,
  jsonResponse,
  overpass,
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

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));
  const q = (searchParams.get('q') ?? '').trim();
  const radiusM = Math.min(
    Math.max(Number(searchParams.get('radius') ?? 25000), 2000),
    80000,
  );
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 20), 1), 40);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return errResponse('lat and lon required', 400);
  }

  const nameFilter = q
    ? `["name"~"${q.replace(/["\\]/g, '')}",i]`
    : '';

  const query = `
[out:json][timeout:25];
(
  node["leisure"="golf_course"]${nameFilter}(around:${radiusM},${lat},${lon});
  way["leisure"="golf_course"]${nameFilter}(around:${radiusM},${lat},${lon});
  relation["leisure"="golf_course"]${nameFilter}(around:${radiusM},${lat},${lon});
);
out center tags;
`.trim();

  try {
    const raw = (await overpass(query)) as { elements?: OsmElement[] };
    const courses: GolfCourseSummary[] = [];
    for (const el of raw.elements ?? []) {
      const c = centerOf(el);
      if (!c) continue;
      const tags = el.tags ?? {};
      const name = tags.name?.trim() || 'Unnamed golf course';
      const holes = tags.holes ? Number(tags.holes) : undefined;
      const par = tags.par ? Number(tags.par) : undefined;
      courses.push({
        id: `${el.type}/${el.id}`,
        osmType: el.type,
        osmId: el.id,
        name,
        lat: c.lat,
        lon: c.lon,
        holes: Number.isFinite(holes) ? holes : undefined,
        par: Number.isFinite(par) ? par : undefined,
        website: tags.website || tags['contact:website'],
        distanceMi: haversineMi(lat, lon, c.lat, c.lon),
      });
    }
    courses.sort((a, b) => (a.distanceMi ?? 0) - (b.distanceMi ?? 0));
    return jsonResponse({
      courses: courses.slice(0, limit),
      attribution: '© OpenStreetMap contributors (ODbL)',
    });
  } catch (err) {
    return errResponse(err instanceof Error ? err.message : 'courses failed');
  }
}
