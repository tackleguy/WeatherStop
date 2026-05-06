// Vercel Edge Function — proxies the browser's tile request to Windy so
// WINDY_KEY never leaves the server. Cached at the edge for 5 min.
//
// Frontend calls: /api/radar/windy?ts=...&z=...&x=...&y=...
//                 ↑ {z}/{x}/{y} are MapLibre's tile placeholders.
//
// Required env: WINDY_KEY (windy.com/account/api free tier)

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const z = url.searchParams.get('z');
  const x = url.searchParams.get('x');
  const y = url.searchParams.get('y');
  const ts = url.searchParams.get('ts');

  if (!z || !x || !y || !ts) {
    return new Response('Missing z/x/y/ts', { status: 400 });
  }

  const key = process.env.WINDY_KEY;
  if (!key) {
    return new Response('WINDY_KEY not configured', { status: 503 });
  }

  const upstream = `https://tiles.windy.com/tiles/v10.0/radar/${ts}/${z}/${x}/${y}.png?key=${key}`;
  const res = await fetch(upstream, {
    cf: { cacheTtl: 300, cacheEverything: true },
  } as RequestInit);

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
