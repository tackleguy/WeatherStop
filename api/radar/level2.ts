// NEXRAD Level 2 → georeferenced PNG. The "go deep" tier:
//
//   1. List the latest L2 volume in noaa-nexrad-level2 (AWS S3, public)
//   2. Download + parse with `nexrad-level-2-data` (MIT)
//   3. Render the lowest sweep (0.5° tilt) to a 1024×1024 PNG using
//      @napi-rs/canvas (BSD-3-Clause), polar→cartesian by gate index
//   4. Cache the PNG to Vercel Blob keyed on site+product
//   5. Return { url, bbox, timestamp } so the client can mount an
//      image source at the right map coordinates
//
// Runtime is Node 20 because the parser uses Buffer + sharp-style
// canvas operations. maxDuration: 30 leaves headroom for the parse
// + render (typical: 1-3s on warm functions).

import { bboxForSite } from '../_lib/nexradSites.js';
import { put, list } from '@vercel/blob';
import { createCanvas, type ImageData } from '@napi-rs/canvas';
import { Level2Radar } from 'nexrad-level-2-data';

export const config = {
  // Vercel serverless — must be "nodejs" (not "nodejs20.x")
  runtime: 'nodejs',
  maxDuration: 60,
};

// NWS standard reflectivity palette (numeric color stops aren't
// copyrightable). dBZ → RGBA.
const REFL_PALETTE: Array<[number, number, number, number]> = [
  [-30, 0, 236, 236],
  [-25, 1, 160, 246],
  [-20, 0, 0, 246],
  [-15, 0, 255, 0],
  [-10, 0, 200, 0],
  [-5, 0, 144, 0],
  [0, 255, 255, 0],
  [5, 231, 192, 0],
  [10, 255, 144, 0],
  [15, 255, 0, 0],
  [20, 214, 0, 0],
  [25, 192, 0, 0],
  [30, 255, 0, 255],
  [35, 153, 85, 201],
  [40, 255, 255, 255],
  [45, 224, 224, 224],
];

function dbzToColor(dbz: number): [number, number, number, number] {
  if (dbz < -32) return [0, 0, 0, 0]; // transparent
  let last = REFL_PALETTE[0];
  for (const stop of REFL_PALETTE) {
    if (stop[0] > dbz) break;
    last = stop;
  }
  return [last[1], last[2], last[3], 220];
}

// Velocity: red (toward) → near-black (zero) → green (away). Knots.
function velToColor(kts: number): [number, number, number, number] {
  if (Math.abs(kts) < 0.5) return [40, 40, 40, 180];
  if (kts < 0) {
    const t = Math.min(1, -kts / 60);
    return [0, Math.round(120 + t * 135), 0, 220];
  }
  const t = Math.min(1, kts / 60);
  return [Math.round(140 + t * 115), 0, 0, 220];
}

// Correlation Coefficient: 0.5 (debris) → 1.0 (uniform precip). Hail
// and tornado debris signatures show as low-CC blobs.
function ccColor(rho: number): [number, number, number, number] {
  if (Number.isNaN(rho) || rho < 0.3) return [0, 0, 0, 0];
  if (rho < 0.7) return [180, 0, 200, 220]; // purple — debris / non-met
  if (rho < 0.85) return [220, 100, 0, 220]; // red — large hail
  if (rho < 0.95) return [220, 220, 0, 200]; // yellow — mixed
  return [80, 200, 80, 180]; // green — uniform rain
}

type L2Product = 'reflectivity' | 'velocity' | 'correlation';

interface L2Moment {
  gate_count?: number;
  first_gate?: number; // km
  gate_size?: number; // km
  moment_data?: Array<number | null>;
}

interface Level2RadarLike {
  listElevations: () => number[];
  setElevation: (elev: number) => void;
  getAzimuth: (scan: number) => number;
  getHighresReflectivity: (scan?: number) => L2Moment | L2Moment[];
  getHighresVelocity: (scan?: number) => L2Moment | L2Moment[];
  getHighresCorrelationCoefficient: (scan?: number) => L2Moment | L2Moment[];
  data: Record<number, Array<{ record?: Record<string, unknown> }>>;
}

function colorForProduct(
  p: L2Product,
  v: number,
): [number, number, number, number] {
  if (p === 'velocity') return velToColor(v);
  if (p === 'correlation') return ccColor(v);
  return dbzToColor(v);
}

function shouldDropGate(p: L2Product, v: number | null | undefined): boolean {
  if (v == null || Number.isNaN(v)) return true;
  if (p === 'reflectivity' && v < -32) return true;
  if (p === 'velocity' && Math.abs(v) > 100) return true;
  if (p === 'correlation' && (v < 0.3 || v > 1.05)) return true;
  return false;
}

const L2_BUCKET = 'https://unidata-nexrad-level2.s3.amazonaws.com';

/** List latest Archive II volume. NOAA's public bucket denies anonymous
 *  ListObjects; Unidata's mirror allows it. Layout: YYYY/MM/DD/SITE/. */
async function listLatestL2Key(site: string): Promise<string | null> {
  const days: Date[] = [new Date()];
  days.push(new Date(Date.now() - 86_400_000)); // yesterday near UTC midnight

  for (const day of days) {
    const prefix =
      `${day.getUTCFullYear()}/` +
      `${String(day.getUTCMonth() + 1).padStart(2, '0')}/` +
      `${String(day.getUTCDate()).padStart(2, '0')}/${site}/`;
    const url = `${L2_BUCKET}/?list-type=2&prefix=${prefix}&max-keys=1000`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const xml = await res.text();
    const keys = Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g))
      .map((m) => m[1])
      .filter((k) => !k.endsWith('_MDM') && !k.endsWith('_FREE'));
    if (keys.length > 0) return keys[keys.length - 1];
  }
  return null;
}

function productField(product: L2Product): 'reflect' | 'velocity' | 'rho' {
  if (product === 'velocity') return 'velocity';
  if (product === 'correlation') return 'rho';
  return 'reflect';
}

/** Pick the lowest elevation that carries the requested moment. */
function pickElevation(radar: Level2RadarLike, product: L2Product): number | null {
  const field = productField(product);
  for (const elev of radar.listElevations()) {
    const rec = radar.data[elev]?.[0]?.record;
    if (rec && rec[field] != null) return elev;
  }
  return null;
}

function readMoment(
  radar: Level2RadarLike,
  product: L2Product,
  scan: number,
): L2Moment | null {
  try {
    if (product === 'velocity') return radar.getHighresVelocity(scan) as L2Moment;
    if (product === 'correlation') {
      return radar.getHighresCorrelationCoefficient(scan) as L2Moment;
    }
    return radar.getHighresReflectivity(scan) as L2Moment;
  } catch {
    return null;
  }
}

function renderProduct(radar: Level2RadarLike, product: L2Product): Buffer {
  const elev = pickElevation(radar, product);
  if (elev == null) throw new Error('no elevation for product');
  radar.setElevation(elev);

  const SIZE = 512;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);
  const imageData = ctx.createImageData(SIZE, SIZE) as unknown as ImageData;
  const pixels = imageData.data;

  const maxRangeMeters = 230_000;
  const metersPerPixel = (maxRangeMeters * 2) / SIZE;
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const scanCount = radar.data[elev]?.length ?? 0;
  const rStep = scanCount > 360 ? 2 : 1;

  for (let si = 0; si < scanCount; si += rStep) {
    const moment = readMoment(radar, product, si);
    const gates = moment?.moment_data;
    if (!moment || !gates?.length) continue;

    const azDeg = radar.getAzimuth(si);
    const azRad = ((azDeg - 90) * Math.PI) / 180;
    // gate_size / first_gate are kilometers in Archive II high-res moments
    const gateSizeM = (moment.gate_size ?? 0.25) * 1000;
    const firstGateM = (moment.first_gate ?? 0) * 1000;
    const gStep = gates.length > 400 ? 2 : 1;

    for (let gi = 0; gi < gates.length; gi += gStep) {
      const value = gates[gi];
      if (shouldDropGate(product, value)) continue;

      const rangeM = firstGateM + (gi + 0.5) * gateSizeM;
      const px = cx + (rangeM * Math.cos(azRad)) / metersPerPixel;
      const py = cy + (rangeM * Math.sin(azRad)) / metersPerPixel;
      if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) continue;

      const [r, g, b, a] = colorForProduct(product, value as number);
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const ipx = Math.floor(px) + dx;
          const ipy = Math.floor(py) + dy;
          if (ipx < 0 || ipx >= SIZE || ipy < 0 || ipy >= SIZE) continue;
          const idx = (ipy * SIZE + ipx) * 4;
          pixels[idx] = r;
          pixels[idx + 1] = g;
          pixels[idx + 2] = b;
          pixels[idx + 3] = a;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer('image/png');
}

// Named GET export required for Node.js runtime — a default export that
// returns Response is treated as (req, res) and the Response is ignored.
export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url, 'https://x');
  const siteRaw = searchParams.get('site');
  const productRaw = searchParams.get('product') ?? 'reflectivity';

  if (!siteRaw || !/^[A-Za-z]{4}$/.test(siteRaw)) {
    return new Response('invalid site', { status: 400 });
  }
  const site = siteRaw.toUpperCase();
  const product: L2Product =
    productRaw === 'velocity'
      ? 'velocity'
      : productRaw === 'correlation'
        ? 'correlation'
        : 'reflectivity';

  const cacheKey = `l2/${site}/${product}/latest.png`;
  const TTL_MS = 5 * 60_000;
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  // Cache lookup — Blob list with prefix (5-min TTL).
  if (hasBlob) {
    try {
      const existing = await list({ prefix: cacheKey, limit: 1 });
      if (existing.blobs.length > 0) {
        const blob = existing.blobs[0];
        const age = Date.now() - new Date(blob.uploadedAt).getTime();
        if (age < TTL_MS) {
          return Response.json({
            url: blob.url,
            bbox: bboxForSite(site),
            timestamp: blob.uploadedAt,
            site,
            product,
            cached: true,
          });
        }
      }
    } catch {
      // Cache miss / Blob unavailable → render fresh.
    }
  }

  // Find + download the latest L2 volume for the requested site.
  let latestKey: string | null = null;
  try {
    latestKey = await listLatestL2Key(site);
  } catch {
    // S3 listing failed; we'll surface that below.
  }
  if (!latestKey) {
    return new Response('no L2 data available', { status: 404 });
  }

  const fileUrl = `${L2_BUCKET}/${latestKey}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) return new Response('L2 fetch failed', { status: 502 });
  const buffer = Buffer.from(await fileRes.arrayBuffer());

  // Parse with the L2 lib. Elevation 1 is default; we pick the lowest
  // cut that actually carries the requested moment (VEL/RHO alternate).
  const radar = new Level2Radar(buffer) as unknown as Level2RadarLike;
  let png: Buffer;
  try {
    png = renderProduct(radar, product);
  } catch (err) {
    return new Response(
      `L2 render failed: ${err instanceof Error ? err.message : 'error'}`,
      { status: 502 },
    );
  }

  if (hasBlob) {
    try {
      const blob = await put(cacheKey, png, {
        access: 'public',
        contentType: 'image/png',
        cacheControlMaxAge: 300,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return Response.json({
        url: blob.url,
        bbox: bboxForSite(site),
        timestamp: new Date().toISOString(),
        site,
        product,
        cached: false,
      });
    } catch {
      // fall through
    }
  }

  const [w, s, e, n] = bboxForSite(site);
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Source': 'level2-direct',
      'X-Site': site,
      'X-Product': product,
      'X-Bbox': `${w},${s},${e},${n}`,
    },
  });
}
