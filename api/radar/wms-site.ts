// Per-site (and CONUS) NWS OpenGeo WMS proxy.
// All GetMap URLs go through buildOpenGeoWmsUrl so TRANSPARENT+PNG
// can never be omitted (opaque black tiles otherwise).

import {
  buildOpenGeoWmsUrl,
  resolveOpenGeoLayer,
} from '../_lib/opengeoWms.js';

export const config = { runtime: 'edge' };

function isPng(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 8) return false;
  const u = new Uint8Array(buf);
  return u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47;
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const siteRaw = searchParams.get('site');
  const product = searchParams.get('product') ?? 'bref';
  const bbox = searchParams.get('bbox');
  const width = searchParams.get('width') ?? '512';
  const height = searchParams.get('height') ?? '512';
  const time = searchParams.get('time');

  if (!siteRaw || !bbox) {
    return new Response('missing site/bbox', { status: 400 });
  }

  const site = siteRaw.toLowerCase();
  const layer = resolveOpenGeoLayer(site, product);
  if (!layer) {
    return new Response('bad site/product', { status: 400 });
  }

  const upstream = buildOpenGeoWmsUrl({
    layer,
    bbox3857: bbox,
    width,
    height,
    time,
  });

  try {
    const res = await fetch(upstream, {
      headers: { Accept: 'image/png' },
    });
    if (!res.ok) {
      return new Response(`upstream ${res.status}`, { status: res.status });
    }
    const buf = await res.arrayBuffer();
    if (!isPng(buf)) {
      return new Response('upstream returned non-PNG', { status: 502 });
    }
    return new Response(buf, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'X-Source': 'opengeo-wms',
        'X-Layer': layer,
      },
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: 'layer temporarily unavailable',
        upstream: 'opengeo.ncep.noaa.gov',
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
