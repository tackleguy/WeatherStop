// Iowa State Mesonet NEXRAD composite tile proxy. The upstream is a
// keyless XYZ raster tile cache that updates ~every 5 minutes and
// covers all CONUS at zoom 0-11. Proxying lets us cache aggressively
// at the edge and avoids browsers leaking the Referer to the upstream.
//
// Frontend calls: /api/radar/iowa-state?z={z}&x={x}&y={y}&product=...
// Default product is 'nexrad-n0q-900913' (composite reflectivity).

export const config = { runtime: 'edge' };

const UPSTREAM_BASE = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';

// Allowlist the Iowa State products we actually expose. Keeping this
// tight protects us from being used as an open proxy.
const ALLOWED = new Set([
  'nexrad-n0q-900913',
  'nexrad-n0r-900913',
  'nexrad-n0r',
  'goes-east-vis-1km-900913',
]);

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const z = searchParams.get('z');
  const x = searchParams.get('x');
  const y = searchParams.get('y');
  const product = searchParams.get('product') ?? 'nexrad-n0q-900913';

  if (!z || !x || !y) return new Response('missing z/x/y', { status: 400 });
  if (!ALLOWED.has(product)) return new Response('bad product', { status: 400 });

  const upstream = `${UPSTREAM_BASE}/${product}/${z}/${x}/${y}.png`;
  try {
    const res = await fetch(upstream);
    if (!res.ok) {
      return new Response(`upstream ${res.status}`, { status: res.status });
    }
    return new Response(res.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=240, s-maxage=240',
      },
    });
  } catch {
    return new Response('upstream fetch failed', { status: 502 });
  }
}
