// Deutscher Wetterdienst (DWD) radar WMS proxy. Covers Germany only —
// the resolver picks this when the active region is EU-DE and the user
// is at zoom 5+. EPSG:3857 bbox in `minx,miny,maxx,maxy` order.
//
//   /api/radar/dwd?bbox=...&width=1024&height=1024

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const bbox = searchParams.get('bbox');
  const width = searchParams.get('width') ?? '1024';
  const height = searchParams.get('height') ?? '1024';
  if (!bbox) return new Response('missing bbox', { status: 400 });

  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers: 'dwd:Niederschlagsradar',
    crs: 'EPSG:3857',
    bbox,
    width,
    height,
    format: 'image/png',
    transparent: 'true',
  });

  const upstream = `https://maps.dwd.de/geoserver/dwd/ows?${params}`;
  try {
    const res = await fetch(upstream, { headers: { Accept: 'image/png' } });
    if (!res.ok) {
      return new Response(`upstream ${res.status}`, { status: res.status });
    }
    return new Response(res.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=120, s-maxage=120',
        'X-Source': 'dwd',
      },
    });
  } catch {
    return new Response('upstream fetch failed', { status: 502 });
  }
}
