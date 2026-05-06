// Vercel Edge Function — proxies the browser's tile request to Windy so
// WINDY_KEY never leaves the server.
//
// Frontend calls: /api/radar/windy?z=...&x=...&y=...&ts=...&product=radar
// Upstream:       https://tiles.windy.com/tiles/v10.0/{product}-{ts}/{z}/{x}/{y}.png?key=...
//
// `ts` is a 10-minute-rounded epoch in seconds (current radar frame); if
// omitted, we round `Date.now()` and use that. Cached at the edge for 5 min.

export const config = { runtime: 'edge' };

function roundToTenMinutes(epochSec: number): number {
  return Math.floor(epochSec / 600) * 600;
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const z = searchParams.get('z');
  const x = searchParams.get('x');
  const y = searchParams.get('y');
  const tsRaw = searchParams.get('ts');
  const product = searchParams.get('product') ?? 'radar';

  if (!z || !x || !y) {
    return new Response('missing z/x/y', { status: 400 });
  }

  const key = process.env.WINDY_KEY;
  if (!key) return new Response('WINDY_KEY not configured', { status: 503 });

  const ts =
    tsRaw && /^\d+$/.test(tsRaw)
      ? Number(tsRaw)
      : roundToTenMinutes(Math.floor(Date.now() / 1000));

  const upstream = `https://tiles.windy.com/tiles/v10.0/${product}-${ts}/${z}/${x}/${y}.png?key=${key}`;
  const res = await fetch(upstream);

  if (!res.ok) {
    return new Response(`Windy ${res.status}`, { status: res.status });
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
