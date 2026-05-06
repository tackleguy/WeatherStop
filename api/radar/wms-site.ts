// Per-site (and CONUS) NWS WMS proxy. The upstream lives at
// `opengeo.ncep.noaa.gov/geoserver/wms` and serves layers named in the
// form `{workspace}:{layer}` — for radar that's `{site}:{site}_sr_bref`
// (reflectivity) or `{site}:{site}_sr_bvel` (velocity). Site code is
// the lowercase ICAO (`kfws`, `kmia`, …). The CONUS national mosaic
// uses `conus:conus_bref_qcd`.
//
// Frontend calls:
//   /api/radar/wms-site?site=kfws&product=bref&bbox=...&width=512&height=512
//   /api/radar/wms-site?site=conus&product=bref&bbox=...
// `bbox` is EPSG:3857 in `minx,miny,maxx,maxy` order.

export const config = { runtime: 'edge' };

const ALLOWED_PRODUCTS: Record<string, string> = {
  bref: 'sr_bref', // base reflectivity (per-site) — sr stands for super-res
  bvel: 'sr_bvel', // base velocity (per-site)
};

// CONUS layers don't follow the per-site naming pattern.
const CONUS_LAYERS: Record<string, string> = {
  bref: 'conus:conus_bref_qcd',
  cref: 'conus:conus_cref_qcd', // composite (not used today, kept for future)
};

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const siteRaw = searchParams.get('site');
  const product = searchParams.get('product') ?? 'bref';
  const bbox = searchParams.get('bbox');
  const width = searchParams.get('width') ?? '512';
  const height = searchParams.get('height') ?? '512';
  const time = searchParams.get('time'); // optional — most layers serve latest only

  if (!siteRaw || !bbox) {
    return new Response('missing site/bbox', { status: 400 });
  }

  const site = siteRaw.toLowerCase();
  if (!/^[a-z]{4}$|^conus$/.test(site)) {
    return new Response('bad site', { status: 400 });
  }

  let layer: string;
  if (site === 'conus') {
    if (!CONUS_LAYERS[product]) {
      return new Response('bad conus product', { status: 400 });
    }
    layer = CONUS_LAYERS[product];
  } else {
    const suffix = ALLOWED_PRODUCTS[product];
    if (!suffix) return new Response('bad product', { status: 400 });
    layer = `${site}:${site}_${suffix}`;
  }

  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers: layer,
    crs: 'EPSG:3857',
    bbox,
    width,
    height,
    format: 'image/png',
    transparent: 'true',
  });
  if (time) params.set('time', time);

  const upstream = `https://opengeo.ncep.noaa.gov/geoserver/wms?${params}`;
  try {
    const res = await fetch(upstream, {
      // The upstream WMS doesn't require referer/origin but we keep
      // these explicit for clarity / future debugging.
      headers: { Accept: 'image/png' },
    });
    if (!res.ok) {
      return new Response(`upstream ${res.status}`, { status: res.status });
    }
    return new Response(res.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=120, s-maxage=120',
      },
    });
  } catch {
    return new Response('upstream fetch failed', { status: 502 });
  }
}
