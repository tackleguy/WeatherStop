// Client types + fetchers for the Golf section.

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

export async function fetchGolfCourses(
  lat: number,
  lon: number,
  opts?: { q?: string; radius?: number; signal?: AbortSignal },
): Promise<GolfCourseSummary[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
  });
  if (opts?.q) params.set('q', opts.q);
  if (opts?.radius) params.set('radius', String(opts.radius));
  const res = await fetch(`/api/golf/courses?${params}`, {
    signal: opts?.signal,
  });
  if (!res.ok) throw new Error(`courses ${res.status}`);
  const data = (await res.json()) as { courses: GolfCourseSummary[] };
  return data.courses ?? [];
}

export async function fetchGolfHoles(
  lat: number,
  lon: number,
  opts?: { radius?: number; signal?: AbortSignal },
): Promise<GolfHole[]> {
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
  return data.holes ?? [];
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
