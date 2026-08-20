import { NWS_USER_AGENT } from './_lib/nwsUa.js';
import { resilientFetch } from './_lib/resilientFetch.js';

export const config = { runtime: 'edge' };

interface NWSFeature {
  id: string;
  geometry: GeoJSON.Geometry | null;
  properties: Record<string, unknown>;
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const bbox = searchParams.get('bbox');

  let upstream: Response;
  try {
    upstream = await resilientFetch('https://api.weather.gov/alerts/active', {
      attempts: 3,
      timeoutMs: 10_000,
      init: {
        headers: {
          'User-Agent': NWS_USER_AGENT,
          Accept: 'application/geo+json',
        },
      },
    });
  } catch {
    return new Response('NWS unavailable', { status: 503 });
  }

  if (!upstream.ok) {
    return new Response('NWS unavailable', { status: 503 });
  }

  const data = (await upstream.json()) as { features: NWSFeature[] };

  if (bbox) {
    const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
    if (
      Number.isFinite(minLon) &&
      Number.isFinite(minLat) &&
      Number.isFinite(maxLon) &&
      Number.isFinite(maxLat)
    ) {
      data.features = data.features.filter((f) => {
        if (!f.geometry) return false;
        const flat =
          JSON.stringify(f.geometry)
            .match(/-?\d+\.\d+/g)
            ?.map(Number) ?? [];
        for (let i = 0; i < flat.length; i += 2) {
          const lon = flat[i];
          const lat = flat[i + 1];
          if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat)
            return true;
        }
        return false;
      });
    }
  }

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/geo+json',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  });
}
