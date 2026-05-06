// Optional Vercel Edge proxy for NWS active alerts. The frontend calls
// api.weather.gov directly today (CORS works), but routing through here
// gives us a 60s edge cache and lets us add a real User-Agent header when
// NWS clamps down on anonymous browser requests.

export const config = { runtime: 'edge' };

export default async function handler(): Promise<Response> {
  const upstream = 'https://api.weather.gov/alerts/active?status=actual';
  const res = await fetch(upstream, {
    headers: {
      Accept: 'application/geo+json',
      'User-Agent': 'weather-stop-radar (contact@example.com)',
    },
  });
  if (!res.ok) {
    return new Response(`NWS ${res.status}`, { status: res.status });
  }
  return new Response(res.body, {
    headers: {
      'Content-Type': 'application/geo+json',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
