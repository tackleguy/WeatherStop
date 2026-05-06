// Weather-cams proxy. CAMS_API_KEY stays server-side. Browser calls
// /api/cams?lat=...&lon=...&radius=... and we forward to whichever cams
// provider the env vars are configured for.
//
// Defaults to the Windy Webcams v3 API. Override via:
//   CAMS_API_BASE   — base URL (no trailing slash)
//   CAMS_API_HEADER — header name carrying the key (default x-windy-api-key)
// If your provider expects the key as a query string, set
//   CAMS_API_HEADER=__query__
// and we'll append `?key=...` instead of setting a header.

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const radius = url.searchParams.get('radius') ?? '50';
  const limit = url.searchParams.get('limit') ?? '20';

  if (!lat || !lon) {
    return new Response('missing lat/lon', { status: 400 });
  }

  const key = process.env.CAMS_API_KEY;
  if (!key) {
    return new Response(
      JSON.stringify({ error: 'CAMS_API_KEY not configured' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const base = (process.env.CAMS_API_BASE ?? 'https://api.windy.com/webcams/api/v3').replace(
    /\/$/,
    '',
  );
  const headerName = process.env.CAMS_API_HEADER ?? 'x-windy-api-key';

  const params = new URLSearchParams({
    nearby: `${lat},${lon},${radius}`,
    limit,
    include: 'images,location,player',
  });

  let upstreamUrl = `${base}/webcams?${params.toString()}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (headerName === '__query__') {
    upstreamUrl += `&key=${encodeURIComponent(key)}`;
  } else {
    headers[headerName] = key;
  }

  try {
    const upstream = await fetch(upstreamUrl, { headers });
    if (!upstream.ok) {
      return new Response(`cams upstream ${upstream.status}`, {
        status: upstream.status,
      });
    }
    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'cams fetch failed', message: String(err) }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }
}
