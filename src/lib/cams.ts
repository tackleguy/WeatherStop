// Front-end client for the weather-cams proxy. Returns a normalized
// shape (id / title / thumbnail / preview / location) so consumers
// don't need to care which upstream cams provider is configured.
//
// Today's normalizer assumes Windy's Webcams v3 response. If you swap
// providers, update mapWindyWebcam() / write a new mapper.

export interface CamItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  previewUrl: string;
  playerUrl?: string;
  lat: number;
  lon: number;
  city?: string;
  region?: string;
  country?: string;
  /** Distance from the query origin in km (Windy provides this). */
  distanceKm?: number;
}

interface WindyImage {
  current?: { preview?: string; thumbnail?: string };
  daylight?: { preview?: string; thumbnail?: string };
}

interface WindyLocation {
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface WindyPlayer {
  day?: { embed?: string };
  live?: { embed?: string };
}

interface WindyWebcam {
  webcamId?: string | number;
  title?: string;
  images?: WindyImage;
  location?: WindyLocation;
  player?: WindyPlayer;
  distance?: number;
}

interface WindyResponse {
  total?: number;
  webcams?: WindyWebcam[];
}

function mapWindyWebcam(w: WindyWebcam): CamItem | null {
  const id = w.webcamId != null ? String(w.webcamId) : null;
  const lat = w.location?.latitude;
  const lon = w.location?.longitude;
  if (!id || lat == null || lon == null) return null;
  const thumb =
    w.images?.current?.thumbnail ?? w.images?.daylight?.thumbnail ?? '';
  const preview =
    w.images?.current?.preview ?? w.images?.daylight?.preview ?? thumb;
  const player = w.player?.live?.embed ?? w.player?.day?.embed;
  return {
    id,
    title: w.title ?? 'Webcam',
    thumbnailUrl: thumb,
    previewUrl: preview,
    playerUrl: player,
    lat,
    lon,
    city: w.location?.city,
    region: w.location?.region,
    country: w.location?.country,
    distanceKm: w.distance,
  };
}

export async function fetchCamsNear(
  lat: number,
  lon: number,
  opts: { radiusKm?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<CamItem[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius: String(opts.radiusKm ?? 50),
    limit: String(opts.limit ?? 20),
  });
  const res = await fetch(`/api/cams?${params}`, { signal: opts.signal });
  if (!res.ok) {
    if (res.status === 503) {
      // Server-side key missing — caller should render the empty state.
      return [];
    }
    throw new Error(`cams ${res.status}`);
  }
  const json = (await res.json()) as WindyResponse;
  const list = json.webcams ?? [];
  return list
    .map(mapWindyWebcam)
    .filter((x): x is CamItem => x !== null);
}
