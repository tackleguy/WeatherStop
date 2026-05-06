// Vercel Edge Function — proxies the NOAA mapservices radar ImageServer.
// This is the high-resolution NEXRAD reflectivity layer; it returns an
// already-georeferenced, already-colored PNG, so we just pass it through.
//
// Frontend calls:
//   /api/radar/nexrad?bbox=minLon,minLat,maxLon,maxLat&size=2048,2048&time=epochMs
// Upstream:
//   https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/
//     radar_base_reflectivity_time/ImageServer/exportImage?...
//
// 5-minute update cadence. 4-hour rolling window for `time` queries.

export const config = { runtime: 'edge' };

const UPSTREAM_BASE =
  'https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity_time/ImageServer/exportImage';

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const bbox = searchParams.get('bbox');
  const size = searchParams.get('size') ?? '1024,1024';
  const time = searchParams.get('time') ?? String(Date.now());

  if (!bbox) return new Response('missing bbox', { status: 400 });

  const params = new URLSearchParams({
    bbox,
    bboxSR: '4326',
    imageSR: '3857',
    size,
    format: 'png',
    transparent: 'true',
    time,
    f: 'image',
  });

  const res = await fetch(`${UPSTREAM_BASE}?${params}`);
  if (!res.ok) {
    return new Response(`NOAA ${res.status}`, { status: res.status });
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=120, s-maxage=120',
    },
  });
}
