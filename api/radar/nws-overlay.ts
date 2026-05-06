// Edge proxy for NOAA mapservices ImageServer products. Returns a single
// georeferenced PNG covering the requested bbox + time. We pass the
// `service` param straight through so each Product can specify its own
// service (radar_base_velocity_time, radar_storm_rel_velocity_time, …).

export const config = { runtime: 'edge' };

const ALLOWED_SERVICES = new Set([
  'radar_base_reflectivity_time',
  'radar_base_velocity_time',
  'radar_storm_rel_velocity_time',
  'radar_echo_tops_time',
  'radar_vil_time',
]);

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const bbox = searchParams.get('bbox');
  const size = searchParams.get('size') ?? '1024,1024';
  const time = searchParams.get('time') ?? String(Date.now());
  const service =
    searchParams.get('service') ?? 'radar_base_reflectivity_time';

  if (!bbox) return new Response('missing bbox', { status: 400 });
  if (!ALLOWED_SERVICES.has(service)) {
    return new Response('bad service', { status: 400 });
  }

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

  const upstream = `https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/${service}/ImageServer/exportImage?${params}`;
  const res = await fetch(upstream);
  if (!res.ok) {
    return new Response(`upstream ${res.status}`, { status: res.status });
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=120, s-maxage=120',
    },
  });
}
