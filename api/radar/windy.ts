// Edge proxy for Windy tile server. WINDY_KEY is server-only.
// Tile URL pattern: tiles.windy.com/tiles/v10.0/{product}-{ts}/{z}/{x}/{y}.png

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const z = searchParams.get('z');
  const x = searchParams.get('x');
  const y = searchParams.get('y');
  const product = searchParams.get('product') ?? 'radar';
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
