// NWS active alerts proxy. NWS requires User-Agent + recommends our
// 60-second cache cadence. Optional bbox= filters to alerts whose
// geometry intersects the box.

export const config = { runtime: 'edge' };

interface NWSFeature {
  id: string;
  geometry: GeoJSON.Geometry | null;
  properties: Record<string, unknown>;
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const bbox = searchParams.get('bbox');

  const upstream = await fetch('https://api.weather.gov/alerts/active', {
    headers: {
      'User-Agent':
        process.env.NWS_USER_AGENT ?? 'weather-stop/1.0 (contact@example.com)',
      Accept: 'application/geo+json',
    },
  });

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
