// NHC tropical MapServer GeoJSON proxy (free, keyless).

export const config = { runtime: 'edge' };

const MAPSERVER_BASE =
  'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather_summary/MapServer';

const ALLOWED_LAYERS = new Set([3, 5, 6, 7, 8, 15, 30, 31, 32]);

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const layerRaw = searchParams.get('layer') ?? '7';
  const layer = Number(layerRaw);
  if (!ALLOWED_LAYERS.has(layer)) {
    return new Response('bad layer', { status: 400 });
  }

  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    f: 'geojson',
  });
  const upstream = `${MAPSERVER_BASE}/${layer}/query?${params}`;

  try {
    const res = await fetch(upstream, {
      headers: { Accept: 'application/geo+json,application/json' },
    });
    if (!res.ok) {
      return new Response(`upstream ${res.status}`, { status: res.status });
    }
    const body = await res.text();
    return new Response(body, {
      headers: {
        'Content-Type': 'application/geo+json',
        'Cache-Control': 'public, max-age=300, s-maxage=600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('upstream fetch failed', { status: 502 });
  }
}
