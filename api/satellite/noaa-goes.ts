// NOAA GOES satellite ImageServer proxy. NOAA's mapservices stack
// publishes a 24-hour animation ImageServer per band; we request the
// latest frame as a static image keyed by bbox. Best coverage is over
// the Americas (GOES-East). At night, band 2 (visible) returns a black
// scene — the resolver downgrades to RainViewer IR for night use.
//
//   /api/satellite/noaa-goes?bbox=W,S,E,N&band=2&width=1024&height=1024

export const config = { runtime: 'edge' };

const BAND_SERVICES: Record<string, string> = {
  '2': 'GOES_East_24hr_Animation', // visible loop (daytime)
  '13': 'GOES_East_Band_13_24hr_Animation', // longwave IR
};

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const bbox = searchParams.get('bbox');
  const band = searchParams.get('band') ?? '13';
  const width = searchParams.get('width') ?? '1024';
  const height = searchParams.get('height') ?? '1024';
  if (!bbox) return new Response('missing bbox', { status: 400 });

  const service = BAND_SERVICES[band] ?? BAND_SERVICES['13'];
  const params = new URLSearchParams({
    bbox,
    bboxSR: '4326',
    imageSR: '3857',
    size: `${width},${height}`,
    format: 'png',
    transparent: 'true',
    f: 'image',
  });

  const upstream =
    `https://mapservices.weather.noaa.gov/raster/rest/services/obs/` +
    `${service}/ImageServer/exportImage?${params}`;
  try {
    const res = await fetch(upstream);
    if (!res.ok) {
      return new Response(`upstream ${res.status}`, { status: res.status });
    }
    return new Response(res.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=180, s-maxage=180',
        'X-Source': 'noaa-goes',
      },
    });
  } catch {
    return new Response('upstream fetch failed', { status: 502 });
  }
}
