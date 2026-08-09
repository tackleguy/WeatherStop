// Viewport mosaic of free NEXRAD products so velocity / rotation /
// correlation / storm-relative velocity work at CONUS zoom — OpenGeo
// only publishes per-site WMS for velocity, and Unidata L3 is per-site.
//
//   /api/radar/mosaic?product=bvel|n0s|rot|n0c&bbox=minx,miny,maxx,maxy&width=1024&height=1024
//
// `bbox` is EPSG:3857. We pick sites covering the viewport, fetch in
// parallel, and alpha-composite onto one PNG.

import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  bboxForSite,
  sitesCoveringBbox,
} from '../_lib/nexradSites.js';
import {
  lngLatToMeters,
  metersToLngLat,
  parseBbox3857,
} from '../_lib/mercator.js';
import {
  renderSiteL3,
  type L3ProductCode,
} from '../_lib/level3Render.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

type MosaicProduct = 'bvel' | 'n0s' | 'rot' | 'n0c';

const OPENGEO = 'https://opengeo.ncep.noaa.gov/geoserver/wms';

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        const r = await fn(items[idx]);
        if (r != null) out.push(r);
      } catch {
        // skip failed site
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () =>
      worker(),
    ),
  );
  return out;
}

async function fetchOpenGeoSite(
  site: string,
  bbox: string,
  width: number,
  height: number,
): Promise<Buffer | null> {
  const layer = `${site}:${site}_sr_bvel`;
  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers: layer,
    crs: 'EPSG:3857',
    bbox,
    width: String(width),
    height: String(height),
    format: 'image/png',
    transparent: 'true',
  });
  const res = await fetch(`${OPENGEO}?${params}`, {
    headers: { Accept: 'image/png' },
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  // PNG magic — skip XML exception reports and empty tiles.
  if (buf.length < 800) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    return null;
  }
  return buf;
}

function countOpaque(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  width: number,
  height: number,
): number {
  const step = Math.max(1, Math.floor(Math.min(width, height) / 64));
  const { data } = ctx.getImageData(0, 0, width, height);
  let n = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] > 24) n++;
    }
  }
  return n;
}

async function compositeOpenGeo(
  layers: Buffer[],
  width: number,
  height: number,
): Promise<{ png: Buffer; opaque: number }> {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  for (let i = layers.length - 1; i >= 0; i--) {
    try {
      const img = await loadImage(layers[i]);
      ctx.drawImage(img, 0, 0, width, height);
    } catch {
      // skip undecodable tile
    }
  }
  const opaque = countOpaque(ctx, width, height);
  return { png: canvas.toBuffer('image/png'), opaque };
}

async function compositeL3Sites(
  sites: string[],
  product: L3ProductCode,
  mosaic: [number, number, number, number],
  width: number,
  height: number,
): Promise<{ png: Buffer; opaque: number }> {
  const [mx0, my0, mx1, my1] = mosaic;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  const pngs = await mapPool(sites, 6, async (icao) => {
    const png = await renderSiteL3(icao, product, 320);
    if (!png) return null;
    return { icao, png };
  });

  // Farther first
  for (let i = pngs.length - 1; i >= 0; i--) {
    const { icao, png } = pngs[i];
    const [w, s, e, n] = bboxForSite(icao);
    const [sx0, sy0] = lngLatToMeters(w, s);
    const [sx1, sy1] = lngLatToMeters(e, n);
    const px = ((sx0 - mx0) / (mx1 - mx0)) * width;
    const py = ((my1 - sy1) / (my1 - my0)) * height;
    const pw = ((sx1 - sx0) / (mx1 - mx0)) * width;
    const ph = ((sy1 - sy0) / (my1 - my0)) * height;
    if (pw < 2 || ph < 2) continue;
    const img = await loadImage(png);
    ctx.drawImage(img, px, py, pw, ph);
  }

  const opaque = countOpaque(ctx, width, height);
  return { png: canvas.toBuffer('image/png'), opaque };
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url, 'https://x');
  const productRaw = (searchParams.get('product') ?? 'bvel').toLowerCase();
  const bboxStr = searchParams.get('bbox');
  const width = Math.min(
    1536,
    Math.max(256, Number(searchParams.get('width') ?? 1024) || 1024),
  );
  const height = Math.min(
    1536,
    Math.max(256, Number(searchParams.get('height') ?? 1024) || 1024),
  );

  if (!bboxStr) return new Response('missing bbox', { status: 400 });
  const mosaic = parseBbox3857(bboxStr);
  if (!mosaic) return new Response('bad bbox', { status: 400 });

  let product: MosaicProduct;
  if (productRaw === 'bvel' || productRaw === 'velocity') product = 'bvel';
  else if (productRaw === 'n0s' || productRaw === 'srv') product = 'n0s';
  else if (productRaw === 'rot' || productRaw === 'rotation') product = 'rot';
  else if (productRaw === 'n0c' || productRaw === 'correlation')
    product = 'n0c';
  else return new Response('bad product', { status: 400 });

  const [mx0, my0, mx1, my1] = mosaic;
  const [west, south] = metersToLngLat(mx0, my0);
  const [east, north] = metersToLngLat(mx1, my1);
  const span = Math.max(east - west, north - south);
  // Wider views need denser site coverage so CONUS isn't a few dots.
  const openGeoLimit = span > 40 ? 36 : span > 25 ? 28 : span > 10 ? 18 : 12;
  const l3Limit = span > 40 ? 32 : span > 25 ? 24 : span > 10 ? 14 : 10;

  try {
    let png: Buffer;
    let opaque: number;
    if (product === 'bvel') {
      const sites = sitesCoveringBbox(west, south, east, north, openGeoLimit);
      if (sites.length === 0) {
        return new Response('no sites in view', { status: 404 });
      }
      const layers = await mapPool(sites, 10, (icao) =>
        fetchOpenGeoSite(icao.toLowerCase(), bboxStr, width, height),
      );
      if (layers.length === 0) {
        return new Response('no velocity tiles', { status: 404 });
      }
      ({ png, opaque } = await compositeOpenGeo(layers, width, height));
    } else {
      const l3Product: L3ProductCode =
        product === 'rot' ? 'ROT' : product === 'n0c' ? 'N0C' : 'N0S';
      const sites = sitesCoveringBbox(west, south, east, north, l3Limit);
      if (sites.length === 0) {
        return new Response('no sites in view', { status: 404 });
      }
      ({ png, opaque } = await compositeL3Sites(
        sites,
        l3Product,
        mosaic,
        width,
        height,
      ));
    }

    // Sampled grid — ~64² cells; require a handful of opaque samples.
    if (opaque < 8) {
      return new Response('empty mosaic', { status: 404 });
    }

    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=90, s-maxage=90',
        'X-Source': 'radar-mosaic',
        'X-Product': product,
        'X-Opaque-Samples': String(opaque),
      },
    });
  } catch (err) {
    return new Response(
      `mosaic failed: ${err instanceof Error ? err.message : 'error'}`,
      { status: 502 },
    );
  }
}
