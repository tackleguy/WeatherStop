// NEXRAD station inventory + status from NWS. Used by the (future)
// StationModal to show online/offline state and let the user lock
// the map onto a specific site.

export const config = { runtime: 'edge' };

export default async function handler(): Promise<Response> {
  const upstream = await fetch('https://api.weather.gov/radar/stations', {
    headers: {
      'User-Agent':
        process.env.NWS_USER_AGENT ?? 'weather-stop/1.0 (contact@example.com)',
      Accept: 'application/geo+json',
    },
  });
  if (!upstream.ok) {
    return new Response('NWS unavailable', { status: 503 });
  }
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'application/geo+json',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
