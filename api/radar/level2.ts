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

import { put, list } from '@vercel/blob';
import { createCanvas, type ImageData } from '@napi-rs/canvas';
import { Level2Radar } from 'nexrad-level-2-data';
import { NEXRAD_SITES } from '../../src/lib/nexradSites';

export const config = {
  runtime: 'nodejs20.x',
  maxDuration: 30,
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

interface L2RadialMomentSamples {
  data?: number[];
  values?: number[];
}
interface L2Radial {
  azimuth?: number;
  azimuth_angle?: number;
  moments?: Record<string, L2RadialMomentSamples>;
  gates?: number[];
}
interface L2Sweep {
  record?: { radials?: L2Radial[] };
  radials?: L2Radial[];
  gateSize?: number;
}

function readSweepRadials(sweep: L2Sweep): L2Radial[] {
  return sweep.record?.radials ?? sweep.radials ?? [];
}
function readGates(radial: L2Radial, momentKey: 'REF' | 'VEL'): number[] {
  const m = radial.moments?.[momentKey];
  if (m?.data) return m.data;
  if (m?.values) return m.values;
  if (radial.gates) return radial.gates;
  return [];
}

function bboxForSite(siteId: string): [number, number, number, number] {
  const s = NEXRAD_SITES.find((x) => x.id === siteId);
  if (!s) throw new Error(`unknown site ${siteId}`);
  // 230km radius converted to ~2.07° lat. Adjust longitude for cosine.
  const dLat = 230 / 111;
  const dLon = 230 / (111 * Math.cos((s.lat * Math.PI) / 180));
  return [s.lon - dLon, s.lat - dLat, s.lon + dLon, s.lat + dLat];
}

async function listLatestL2Key(site: string): Promise<string | null> {
  const today = new Date();
  const prefix =
    `${today.getUTCFullYear()}/` +
    `${String(today.getUTCMonth() + 1).padStart(2, '0')}/` +
    `${String(today.getUTCDate()).padStart(2, '0')}/${site}/`;
  const url = `https://noaa-nexrad-level2.s3.amazonaws.com/?list-type=2&prefix=${prefix}&max-keys=20`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const xml = await res.text();
  const keys = Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g))
    .map((m) => m[1])
    .filter((k) => !k.endsWith('_MDM') && !k.endsWith('_FREE'));
  if (keys.length === 0) return null;
  return keys[keys.length - 1];
}

function renderSweep(
  sweep: L2Sweep,
  product: 'reflectivity' | 'velocity',
): { png: Buffer; volumeStart?: string } {
  const SIZE = 1024;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);

  const imageData = ctx.createImageData(SIZE, SIZE) as unknown as ImageData;
  const pixels = imageData.data;

  const radials = readSweepRadials(sweep);
  const gateSize = sweep.gateSize ?? 250;
  const maxRangeMeters = 230_000;
  const metersPerPixel = (maxRangeMeters * 2) / SIZE;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const momentKey = product === 'velocity' ? 'VEL' : 'REF';

  for (const radial of radials) {
    const azDeg = radial.azimuth ?? radial.azimuth_angle ?? 0;
    const azRad = ((azDeg - 90) * Math.PI) / 180;
    const gates = readGates(radial, momentKey);

    for (let i = 0; i < gates.length; i++) {
      const value = gates[i];
      if (value == null || Number.isNaN(value)) continue;
      if (product === 'reflectivity' && value < -32) continue;
      if (product === 'velocity' && Math.abs(value) > 100) continue;

      const rangeM = (i + 0.5) * gateSize;
      const px = cx + (rangeM * Math.cos(azRad)) / metersPerPixel;
      const py = cy + (rangeM * Math.sin(azRad)) / metersPerPixel;
      if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) continue;

      const [r, g, b, a] =
        product === 'velocity' ? velToColor(value) : dbzToColor(value);

      // Paint a 2×2 block to fill polar→cartesian gaps.
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
  return { png: canvas.toBuffer('image/png') };
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const siteRaw = searchParams.get('site');
  const productRaw = (searchParams.get('product') ?? 'reflectivity') as
    | 'reflectivity'
    | 'velocity';

  if (!siteRaw || !/^[A-Za-z]{4}$/.test(siteRaw)) {
    return new Response('invalid site', { status: 400 });
  }
  const site = siteRaw.toUpperCase();
  const product: 'reflectivity' | 'velocity' =
    productRaw === 'velocity' ? 'velocity' : 'reflectivity';

  const cacheKey = `l2/${site}/${product}/latest.png`;
  const TTL_MS = 5 * 60_000;

  // Cache lookup — Blob list with prefix (5-min TTL).
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

  const fileUrl = `https://noaa-nexrad-level2.s3.amazonaws.com/${latestKey}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) return new Response('L2 fetch failed', { status: 502 });
  const buffer = Buffer.from(await fileRes.arrayBuffer());

  // Parse with the L2 lib. The library's API has shifted across versions
  // — the cast below keeps us flexible while still type-checking.
  const radar = new (Level2Radar as unknown as { new (b: Buffer): unknown })(
    buffer,
  ) as {
    getHighresReflectivity?: () => L2Sweep[];
    getHighresVelocity?: () => L2Sweep[];
  };
  const sweepData =
    product === 'velocity'
      ? radar.getHighresVelocity?.() ?? []
      : radar.getHighresReflectivity?.() ?? [];
  if (!sweepData || sweepData.length === 0) {
    return new Response('no sweep data', { status: 404 });
  }
  const sweep = sweepData[0]; // lowest tilt

  const { png } = renderSweep(sweep, product);

  let publicUrl: string | undefined;
  try {
    const blob = await put(cacheKey, png, {
      access: 'public',
      contentType: 'image/png',
      cacheControlMaxAge: 300,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    publicUrl = blob.url;
  } catch (err) {
    // Blob misconfigured — return the PNG inline so the feature still
    // works in dev / on a project that hasn't connected Vercel Blob.
    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'X-Source': 'level2-direct',
        'X-Site': site,
        'X-Product': product,
        'X-Note': 'blob unavailable — served inline',
      },
    });
  }

  return Response.json({
    url: publicUrl,
    bbox: bboxForSite(site),
    timestamp: new Date().toISOString(),
    site,
    product,
    cached: false,
  });
}
