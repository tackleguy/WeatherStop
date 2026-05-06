// Iowa State Mesonet NEXRAD composite tile proxy. Keyless XYZ tile
// cache that updates ~every 5 min and covers CONUS at zoom 0-11.
// Proxying lets us cache aggressively at the edge and keeps the
// Referer off the upstream.
//
//   /api/radar/iowa-state?z={z}&x={x}&y={y}&product=...&ts=YYYYMMDDHHMM
//
// `ts` is optional. When present, Iowa State serves the historical
// frame at that minute; when omitted, the live cache (1.0.0) is used.

export const config = { runtime: 'edge' };

const UPSTREAM_HOST = 'https://mesonet.agron.iastate.edu/cache/tile.py';

// Allowlist the products we actually expose, so the proxy can't be
// used to fetch arbitrary upstream paths.
const ALLOWED = new Set([
  'nexrad-n0q-900913',
  'nexrad-n0r-900913',
  'nexrad-n0r',
  'goes-east-vis-1km-900913',
]);

const TS_PATTERN = /^\d{12}$/; // YYYYMMDDHHMM

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const z = searchParams.get('z');
  const x = searchParams.get('x');
  const y = searchParams.get('y');
  const product = searchParams.get('product') ?? 'nexrad-n0q-900913';
  const ts = searchParams.get('ts');

  if (!z || !x || !y) return new Response('missing z/x/y', { status: 400 });
  if (!ALLOWED.has(product)) {
    return new Response('bad product', { status: 400 });
  }
  if (ts && !TS_PATTERN.test(ts)) {
    return new Response('bad ts', { status: 400 });
  }

  const versionSegment = ts ?? '1.0.0';
  const upstream = `${UPSTREAM_HOST}/${versionSegment}/${product}/${z}/${x}/${y}.png`;

  try {
    const res = await fetch(upstream);
    if (!res.ok) {
      return new Response(`upstream ${res.status}`, { status: res.status });
    }
    return new Response(res.body, {
      headers: {
        'Content-Type': 'image/png',
        // Historical frames never change → cache 24h. Live frame → 4 min.
        'Cache-Control': ts
          ? 'public, max-age=86400, s-maxage=86400, immutable'
          : 'public, max-age=240, s-maxage=240',
        'X-Source': 'iowa-state',
      },
    });
  } catch {
    return new Response('upstream fetch failed', { status: 502 });
  }
}
