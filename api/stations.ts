// NEXRAD station inventory + status from NWS. Used by the (future)
// StationModal to show online/offline state and let the user lock
// the map onto a specific site.

export const config = { runtime: 'edge' };

export default async function handler(): Promise<Response> {
  const ua =
    process.env.NWS_USER_AGENT ?? 'weather-stop/1.0 (contact@example.com)';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
    try {
      const upstream = await fetch('https://api.weather.gov/radar/stations', {
        headers: { 'User-Agent': ua, Accept: 'application/geo+json' },
      });
      if (!upstream.ok) {
        if (upstream.status >= 500 && attempt < 2) continue;
        return new Response('NWS unavailable', { status: 503 });
      }
      return new Response(upstream.body, {
        headers: {
          'Content-Type': 'application/geo+json',
          'Cache-Control': 'public, max-age=300, s-maxage=300',
        },
      });
    } catch {
      if (attempt < 2) continue;
    }
  }
  return new Response('NWS unavailable', { status: 503 });
}
