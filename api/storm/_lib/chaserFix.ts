// Shared GPS fix parsing for Dom 3 / famous chaser feeds.

export interface ChaserFix {
  available: boolean;
  id: string;
  label: string;
  team?: string;
  vehicle?: string;
  lat?: number;
  lon?: number;
  heading?: number;
  speedMph?: number;
  updatedAt?: string;
  source?: string;
  color?: string;
  trail?: Array<[number, number]>;
  error?: string;
  notes?: string;
}

export async function parsePositionFeed(
  url: string,
  fallbackLabel: string,
): Promise<Omit<ChaserFix, 'id' | 'available'> & { available: boolean } | null> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json, application/geo+json' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;

  if (data.type === 'FeatureCollection') {
    const fc = data as unknown as GeoJSON.FeatureCollection;
    const f = fc.features.find((x) => x.geometry?.type === 'Point');
    if (f?.geometry && f.geometry.type === 'Point') {
      const [lon, lat] = f.geometry.coordinates;
      const props = (f.properties ?? {}) as Record<string, unknown>;
      return {
        available: true,
        label: String(props.name ?? fallbackLabel),
        lat,
        lon,
        updatedAt: new Date().toISOString(),
        source: 'feed',
      };
    }
  }
  if (data.type === 'Feature') {
    const f = data as unknown as GeoJSON.Feature;
    if (f.geometry?.type === 'Point') {
      const [lon, lat] = f.geometry.coordinates;
      const props = (f.properties ?? {}) as Record<string, unknown>;
      return {
        available: true,
        label: String(props.name ?? fallbackLabel),
        lat,
        lon,
        updatedAt: new Date().toISOString(),
        source: 'feed',
      };
    }
  }
  if (data.type === 'Point') {
    const [lon, lat] = (data as unknown as GeoJSON.Point).coordinates;
    return {
      available: true,
      label: fallbackLabel,
      lat,
      lon,
      updatedAt: new Date().toISOString(),
      source: 'feed',
    };
  }

  const lat = Number(data.lat ?? data.latitude);
  const lon = Number(data.lon ?? data.lng ?? data.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    available: true,
    label: String(data.name ?? data.label ?? fallbackLabel),
    lat,
    lon,
    heading: Number.isFinite(Number(data.heading ?? data.course))
      ? Number(data.heading ?? data.course)
      : undefined,
    speedMph: Number.isFinite(Number(data.speedMph ?? data.speed))
      ? Number(data.speedMph ?? data.speed)
      : undefined,
    updatedAt: String(data.updatedAt ?? data.time ?? new Date().toISOString()),
    source: 'feed',
    trail: Array.isArray(data.trail)
      ? (data.trail as Array<[number, number]>)
      : undefined,
  };
}

export async function fetchAprsFix(
  callsign: string,
  apiKey: string,
  fallbackLabel: string,
): Promise<Omit<ChaserFix, 'id' | 'available'> & { available: boolean } | null> {
  const params = new URLSearchParams({
    name: callsign,
    what: 'loc',
    apikey: apiKey,
    format: 'json',
  });
  const res = await fetch(`https://api.aprs.fi/api/get?${params}`);
  if (!res.ok) return null;
  const body = (await res.json()) as {
    entries?: Array<{
      lat?: string;
      lng?: string;
      course?: string;
      speed?: string;
      time?: string;
      name?: string;
    }>;
  };
  const e = body.entries?.[0];
  if (!e) return null;
  const lat = Number(e.lat);
  const lon = Number(e.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const knots = Number(e.speed);
  return {
    available: true,
    label: e.name || callsign || fallbackLabel,
    lat,
    lon,
    heading: Number.isFinite(Number(e.course)) ? Number(e.course) : undefined,
    speedMph: Number.isFinite(knots) ? Math.round(knots * 1.15078) : undefined,
    updatedAt: e.time
      ? new Date(Number(e.time) * 1000).toISOString()
      : new Date().toISOString(),
    source: 'aprs.fi',
  };
}
