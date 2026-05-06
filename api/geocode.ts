// Nominatim geocoder proxy. Browser CORS works against Nominatim, but
// going through here lets us add a real User-Agent (Nominatim policy)
// and a small edge cache to stay under the 1 req/s rate limit.

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const limit = searchParams.get('limit') ?? '6';
  if (!q) return new Response('missing q', { status: 400 });

  const params = new URLSearchParams({
    format: 'json',
    q,
    limit,
    addressdetails: '0',
  });
  const upstream = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        'User-Agent':
          process.env.NWS_USER_AGENT ?? 'weather-stop/1.0 (contact@example.com)',
        Accept: 'application/json',
      },
    },
  );
  if (!upstream.ok) {
    return new Response(`upstream ${upstream.status}`, {
      status: upstream.status,
    });
  }
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  });
}
