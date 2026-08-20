// Dominator 3 tracker proxy.
// There is no official public Dom 3 GPS API. This endpoint accepts:
//   DOM3_FEED_URL  — JSON {lat,lon,heading?,speedMph?,updatedAt?,name?}
//                    or GeoJSON Point / Feature
//   DOM3_APRS_CALL + APRS_API_KEY — optional aprs.fi lookup
// Without config it returns available:false (UI can still show the layer empty).

export const config = { runtime: 'edge' };

export interface Dom3Fix {
  available: boolean;
  label: string;
  lat?: number;
  lon?: number;
  heading?: number;
  speedMph?: number;
  updatedAt?: string;
  source?: string;
  trail?: Array<[number, number]>;
  error?: string;
  disclaimer: string;
}

const DISCLAIMER =
  'Dom 3 position is only shown when a public/licensed feed is configured. Not affiliated with Team Dominator.';

async function fromFeedUrl(url: string): Promise<Dom3Fix | null> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json, application/geo+json' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;

  // GeoJSON Feature / FeatureCollection / Point
  if (data.type === 'FeatureCollection') {
    const fc = data as unknown as GeoJSON.FeatureCollection;
    const f = fc.features.find((x) => x.geometry?.type === 'Point');
    if (f?.geometry && f.geometry.type === 'Point') {
      const [lon, lat] = f.geometry.coordinates;
      return {
        available: true,
        label: String(
          (f.properties as Record<string, unknown> | null)?.name ??
            'Dominator 3',
        ),
        lat,
        lon,
        updatedAt: new Date().toISOString(),
        source: 'feed',
        disclaimer: DISCLAIMER,
      };
    }
  }
  if (data.type === 'Feature') {
    const f = data as unknown as GeoJSON.Feature;
    if (f.geometry?.type === 'Point') {
      const [lon, lat] = f.geometry.coordinates;
      return {
        available: true,
        label: String(
          (f.properties as Record<string, unknown> | null)?.name ??
            'Dominator 3',
        ),
        lat,
        lon,
        updatedAt: new Date().toISOString(),
        source: 'feed',
        disclaimer: DISCLAIMER,
      };
    }
  }
  if (data.type === 'Point') {
    const [lon, lat] = (data as unknown as GeoJSON.Point).coordinates;
    return {
      available: true,
      label: 'Dominator 3',
      lat,
      lon,
      updatedAt: new Date().toISOString(),
      source: 'feed',
      disclaimer: DISCLAIMER,
    };
  }

  const lat = Number(data.lat ?? data.latitude);
  const lon = Number(data.lon ?? data.lng ?? data.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    available: true,
    label: String(data.name ?? data.label ?? 'Dominator 3'),
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
    trail: Array.isArray(data.trail) ? (data.trail as Array<[number, number]>) : undefined,
    disclaimer: DISCLAIMER,
  };
}

async function fromAprs(
  callsign: string,
  apiKey: string,
): Promise<Dom3Fix | null> {
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
  // aprs.fi speed is knots
  const knots = Number(e.speed);
  return {
    available: true,
    label: e.name || callsign || 'Dominator 3',
    lat,
    lon,
    heading: Number.isFinite(Number(e.course)) ? Number(e.course) : undefined,
    speedMph: Number.isFinite(knots) ? Math.round(knots * 1.15078) : undefined,
    updatedAt: e.time
      ? new Date(Number(e.time) * 1000).toISOString()
      : new Date().toISOString(),
    source: 'aprs.fi',
    disclaimer: DISCLAIMER,
  };
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const overrideFeed = searchParams.get('feed')?.trim();
  const feed = overrideFeed || process.env.DOM3_FEED_URL?.trim();
  const callsign =
    searchParams.get('callsign')?.trim() ||
    process.env.DOM3_APRS_CALL?.trim() ||
    process.env.DOM3_CALLSIGN?.trim();
  const aprsKey = process.env.APRS_API_KEY?.trim();

  try {
    if (feed) {
      const fix = await fromFeedUrl(feed);
      if (fix) {
        return new Response(JSON.stringify(fix), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=15, s-maxage=15',
          },
        });
      }
    }
    if (callsign && aprsKey) {
      const fix = await fromAprs(callsign, aprsKey);
      if (fix) {
        return new Response(JSON.stringify(fix), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=30, s-maxage=30',
          },
        });
      }
    }

    const empty: Dom3Fix = {
      available: false,
      label: 'Dominator 3',
      error:
        'No live Dom 3 feed configured. Set DOM3_FEED_URL or DOM3_APRS_CALL + APRS_API_KEY, or paste a feed URL in Settings.',
      disclaimer: DISCLAIMER,
    };
    return new Response(JSON.stringify(empty), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        available: false,
        label: 'Dominator 3',
        error: err instanceof Error ? err.message : 'Dom 3 fetch failed',
        disclaimer: DISCLAIMER,
      } satisfies Dom3Fix),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      },
    );
  }
}
