// Convenience proxy for Windy's satellite tiles. Same upstream as
// /api/radar/windy?product=satellite — having a separate route keeps the
// product-rail wiring explicit ("satellite is its own thing"), and lets
// us swap in a different upstream (e.g. RealEarth) without touching
// the radar route.

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const z = searchParams.get('z');
  const x = searchParams.get('x');
  const y = searchParams.get('y');
  const product = searchParams.get('product') ?? 'satellite';
  const ts =
    searchParams.get('ts') ??
    String(Math.floor(Date.now() / 1000 / 600) * 600);

  if (!z || !x || !y) {
    return new Response('missing z/x/y', { status: 400 });
  }

  const key = process.env.WINDY_KEY;
  if (!key) return new Response('server misconfig', { status: 500 });

  const upstream = `https://tiles.windy.com/tiles/v10.0/${product}-${ts}/${z}/${x}/${y}.png?key=${key}`;
  const res = await fetch(upstream);
  if (!res.ok) {
    return new Response(`upstream ${res.status}`, { status: res.status });
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
