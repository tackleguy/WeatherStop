// Client types + fetchers for the Golf section.
// Memory + sessionStorage cache so reopening a course / city is instant.

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

export interface GolfHole {
  number: number;
  name?: string;
  par?: number;
  yards: number;
  bearingDeg: number;
  tee: { lat: number; lon: number };
  green: { lat: number; lon: number };
  path?: Array<{ lat: number; lon: number }>;
  source: 'hole-way' | 'tee-green';
}

export interface HoleBrief {
  number: number;
  yards: number;
  bearingDeg: number;
  windFromDeg: number;
  windMph: number;
  gustMph: number;
  /** Positive = into the player, negative = helping. */
  headwindMph: number;
  /** Positive = pushes the ball right of the tee→green line. */
  crosswindMph: number;
  /** Estimated lateral drift at the green, yards; positive = right. */
  driftYards: number;
  playsLikeYards: number;
  aspect: string;
  tip: string;
  clubHint: string;
  modelAgreement: number;
}

export interface GolfEnsemble {
  lat: number;
  lon: number;
  hour: number;
  time: string | null;
  ensemble: {
    windFromDeg: number;
    windMph: number;
    gustMph: number;
    agreement: number;
    modelsUsed: string[];
    modelsFailed: Array<{ model: string; reason?: string }>;
  };
  summary: string;
  holes: HoleBrief[];
  attribution: string;
}

const MEM = new Map<string, { at: number; data: unknown }>();
const COURSES_TTL_MS = 30 * 60_000;
const HOLES_TTL_MS = 6 * 60 * 60_000;

function q3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function q4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function memGet<T>(key: string, ttl: number): T | null {
  const hit = MEM.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttl) {
    MEM.delete(key);
    return null;
  }
  return hit.data as T;
}

function memSet(key: string, data: unknown): void {
  MEM.set(key, { at: Date.now(), data });
}

function sessionGet<T>(key: string, ttl: number): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: T };
    if (Date.now() - parsed.at > ttl) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function sessionSet(key: string, data: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // quota / private mode — memory cache still helps
  }
}

export async function fetchGolfCourses(
  lat: number,
  lon: number,
  opts?: { radius?: number; signal?: AbortSignal },
): Promise<GolfCourseSummary[]> {
  const key = `golf:courses:${q3(lat)}:${q3(lon)}:${opts?.radius ?? ''}`;
  const cached =
    memGet<GolfCourseSummary[]>(key, COURSES_TTL_MS) ??
    sessionGet<GolfCourseSummary[]>(key, COURSES_TTL_MS);
  if (cached) {
    memSet(key, cached);
    return cached;
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
  });
  if (opts?.radius) params.set('radius', String(opts.radius));
  const res = await fetch(`/api/golf/courses?${params}`, {
    signal: opts?.signal,
  });
  if (!res.ok) throw new Error(`courses ${res.status}`);
  const data = (await res.json()) as { courses: GolfCourseSummary[] };
  const courses = data.courses ?? [];
  memSet(key, courses);
  sessionSet(key, courses);
  return courses;
}

export async function fetchGolfHoles(
  lat: number,
  lon: number,
  opts?: { radius?: number; signal?: AbortSignal },
): Promise<GolfHole[]> {
  const key = `golf:holes:${q4(lat)}:${q4(lon)}:${opts?.radius ?? ''}`;
  const cached =
    memGet<GolfHole[]>(key, HOLES_TTL_MS) ??
    sessionGet<GolfHole[]>(key, HOLES_TTL_MS);
  if (cached) {
    memSet(key, cached);
    return cached;
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
  });
  if (opts?.radius) params.set('radius', String(opts.radius));
  const res = await fetch(`/api/golf/holes?${params}`, {
    signal: opts?.signal,
  });
  if (!res.ok) throw new Error(`holes ${res.status}`);
  const data = (await res.json()) as { holes: GolfHole[] };
  const holes = data.holes ?? [];
  memSet(key, holes);
  sessionSet(key, holes);
  return holes;
}

export async function fetchGolfEnsemble(
  lat: number,
  lon: number,
  holes: Array<Pick<GolfHole, 'number' | 'yards' | 'bearingDeg' | 'par' | 'name'>>,
  hour = 0,
  signal?: AbortSignal,
): Promise<GolfEnsemble> {
  const res = await fetch('/api/golf/ensemble', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, hour, holes }),
    signal,
  });
  if (!res.ok) throw new Error(`ensemble ${res.status}`);
  return (await res.json()) as GolfEnsemble;
}

/** Esri World Imagery — high-detail satellite basemap for course maps. */
export const GOLF_SATELLITE_STYLE = {
  version: 8 as const,
  name: 'Golf Satellite',
  sources: {
    esri: {
      type: 'raster' as const,
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution:
        'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'esri-sat',
      type: 'raster' as const,
      source: 'esri',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};
