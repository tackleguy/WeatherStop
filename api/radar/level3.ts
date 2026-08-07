// Unidata NEXRAD Level 3 → PNG / GeoJSON. Free public S3 bucket:
//   https://unidata-nexrad-level3.s3.amazonaws.com/
//
// Products:
//   N0S — storm-relative velocity radial PNG
//   ROT — azimuthal shear derived from N0S (rotation product)
//
// File naming: SSS_PPP_YYYY_MM_DD_HH_MM_SS where SSS is the site
// without a leading K (KFWS → FWS).

import { put, list } from '@vercel/blob';
import { createCanvas, type ImageData } from '@napi-rs/canvas';
import { createRequire } from 'node:module';
import { bboxForSite } from '../_lib/nexradSites.js';

const require = createRequire(import.meta.url);
const parseLevel3 = require('nexrad-level-3-data') as (
  file: Buffer,
  options?: { logger?: false | Console },
) => Level3Data;

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

type L3Product = 'N0S' | 'ROT';

interface Level3Radial {
  startAngle: number;
  angleDelta: number;
  bins: number[];
}

interface Level3Packet {
  firstBin: number;
  numberBins: number;
  rangeScale: number;
  radials: Level3Radial[];
}

interface Level3Data {
  textHeader?: { type?: string; id3?: string };
  productDescription?: {
    latitude?: number;
    longitude?: number;
    maxNegativeVelocity?: number;
    maxPositiveVelocity?: number;
  };
  radialPackets?: Level3Packet[];
}

function siteCode(icao: string): string {
  const u = icao.toUpperCase();
  return u.startsWith('K') && u.length === 4 ? u.slice(1) : u;
}

async function listLatestL3Key(
  site3: string,
  code: string,
): Promise<string | null> {
  const now = new Date();
  // Try the current and previous UTC hours first (small lists), then the day.
  const attempts: string[] = [];
  for (let h = 0; h < 3; h++) {
    const d = new Date(now.getTime() - h * 3_600_000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hour = String(d.getUTCHours()).padStart(2, '0');
    attempts.push(`${site3}_${code}_${y}_${m}_${day}_${hour}_`);
  }
  {
    const d = now;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    attempts.push(`${site3}_${code}_${y}_${m}_${day}_`);
  }

  for (const prefix of attempts) {
    const url = `https://unidata-nexrad-level3.s3.amazonaws.com/?list-type=2&prefix=${prefix}&max-keys=200`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const xml = await res.text();
    const keys = Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g)).map(
      (m) => m[1],
    );
    if (keys.length > 0) return keys[keys.length - 1];
  }
  return null;
}

/** Map 16-level N0S bin codes to knots using product max ± velocities. */
function binToKnots(
  bin: number,
  maxNeg: number,
  maxPos: number,
): number | null {
  if (!bin || bin <= 0) return null;
  // Levels 1–15 span maxNeg → maxPos. Level codes above 15 are RF/special.
  if (bin > 15) return null;
  return maxNeg + ((bin - 1) / 14) * (maxPos - maxNeg);
}

function velToColor(kts: number): [number, number, number, number] {
  if (Math.abs(kts) < 0.5) return [40, 40, 40, 180];
  if (kts < 0) {
    const t = Math.min(1, -kts / 60);
    return [0, Math.round(120 + t * 135), 0, 220];
  }
  const t = Math.min(1, kts / 60);
  return [Math.round(140 + t * 115), 0, 0, 220];
}

/** Cyclonic (pos) warm / anticyclonic (neg) cool shear palette. */
function shearToColor(shear: number): [number, number, number, number] {
  const mag = Math.abs(shear);
  if (mag < 0.5) return [0, 0, 0, 0];
  const t = Math.min(1, mag / 20);
  if (shear > 0) {
    // Cyclonic — yellow → red → magenta
    return [
      255,
      Math.round(220 * (1 - t)),
      Math.round(80 * t),
      Math.round(160 + 80 * t),
    ];
  }
  // Anticyclonic — cyan → blue
  return [
    Math.round(40 * (1 - t)),
    Math.round(180 + 40 * t),
    255,
    Math.round(160 + 80 * t),
  ];
}

function buildVelocityField(
  packet: Level3Packet,
  maxNeg: number,
  maxPos: number,
): { angles: number[]; field: (number | null)[][] } {
  const angles: number[] = [];
  const field: (number | null)[][] = [];
  for (const radial of packet.radials) {
    angles.push(radial.startAngle);
    const row: (number | null)[] = [];
    for (let i = 0; i < packet.numberBins; i++) {
      row.push(binToKnots(radial.bins[i] ?? 0, maxNeg, maxPos));
    }
    field.push(row);
  }
  return { angles, field };
}

function renderRadialPng(
  packet: Level3Packet,
  maxNeg: number,
  maxPos: number,
  mode: 'velocity' | 'shear',
): Buffer {
  const SIZE = 512;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);
  const imageData = ctx.createImageData(SIZE, SIZE) as unknown as ImageData;
  const pixels = imageData.data;

  const { angles, field } = buildVelocityField(packet, maxNeg, maxPos);
  const n = field.length;
  const gateMeters = 1000 * (packet.rangeScale || 1);
  const maxRangeMeters = packet.numberBins * gateMeters;
  const metersPerPixel = (maxRangeMeters * 2) / SIZE;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  // Skip every other radial/gate to stay under serverless time limits.
  const rStep = n > 180 ? 2 : 1;
  const gStep = packet.numberBins > 120 ? 2 : 1;

  for (let ri = 0; ri < n; ri += rStep) {
    const azDeg = angles[ri];
    const azRad = ((azDeg - 90) * Math.PI) / 180;
    const next = field[(ri + rStep) % n];
    const cur = field[ri];

    for (let gi = 0; gi < packet.numberBins; gi += gStep) {
      let rgba: [number, number, number, number] | null = null;
      if (mode === 'velocity') {
        const v = cur[gi];
        if (v == null) continue;
        rgba = velToColor(v);
      } else {
        const v0 = cur[gi];
        const v1 = next[gi];
        if (v0 == null || v1 == null) continue;
        rgba = shearToColor(v1 - v0);
      }

      const rangeM = (gi + 0.5) * gateMeters + packet.firstBin * gateMeters;
      const px = cx + (rangeM * Math.cos(azRad)) / metersPerPixel;
      const py = cy + (rangeM * Math.sin(azRad)) / metersPerPixel;
      if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) continue;

      const [r, g, b, a] = rgba;
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

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url, 'https://x');
  const siteRaw = searchParams.get('site');
  const productRaw = (searchParams.get('product') ?? 'N0S').toUpperCase();

  if (!siteRaw || !/^[A-Za-z]{3,4}$/.test(siteRaw)) {
    return new Response('invalid site', { status: 400 });
  }

  const siteIcao = siteRaw.toUpperCase().length === 3
    ? `K${siteRaw.toUpperCase()}`
    : siteRaw.toUpperCase();
  const site3 = siteCode(siteIcao);
  const product: L3Product = productRaw === 'ROT' ? 'ROT' : 'N0S';
  const fetchCode = 'N0S'; // ROT is derived from N0S

  const cacheKey = `l3/${site3}/${product}/latest.png`;
  const TTL_MS = 5 * 60_000;
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (hasBlob) {
    try {
      const existing = await list({ prefix: cacheKey, limit: 1 });
      if (existing.blobs.length > 0) {
        const blob = existing.blobs[0];
        const age = Date.now() - new Date(blob.uploadedAt).getTime();
        if (age < TTL_MS) {
          return Response.json({
            url: blob.url,
            bbox: bboxForSite(siteIcao),
            timestamp: blob.uploadedAt,
            site: siteIcao,
            product,
            cached: true,
          });
        }
      }
    } catch {
      // Blob miss → render fresh.
    }
  }

  const latestKey = await listLatestL3Key(site3, fetchCode);
  if (!latestKey) {
    return new Response('no Level 3 data available', { status: 404 });
  }

  const fileRes = await fetch(
    `https://unidata-nexrad-level3.s3.amazonaws.com/${latestKey}`,
  );
  if (!fileRes.ok) return new Response('L3 fetch failed', { status: 502 });
  const buffer = Buffer.from(await fileRes.arrayBuffer());

  let parsed: Level3Data;
  try {
    parsed = parseLevel3(buffer, { logger: false });
  } catch (err) {
    return new Response(
      `L3 parse failed: ${err instanceof Error ? err.message : 'error'}`,
      { status: 502 },
    );
  }

  const packet = parsed.radialPackets?.[0];
  if (!packet?.radials?.length) {
    return new Response('no radial data', { status: 404 });
  }

  const maxNeg = parsed.productDescription?.maxNegativeVelocity ?? -60;
  const maxPos = parsed.productDescription?.maxPositiveVelocity ?? 60;
  const png = renderRadialPng(
    packet,
    maxNeg,
    maxPos,
    product === 'ROT' ? 'shear' : 'velocity',
  );

  // Prefer inline PNG — Blob upload adds cold-start latency and often
  // isn't configured. Client accepts both JSON {url,bbox} and raw PNG.
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
        bbox: bboxForSite(siteIcao),
        timestamp: new Date().toISOString(),
        site: siteIcao,
        product,
        cached: false,
      });
    } catch {
      // fall through to inline
    }
  }

  const [w, s, e, n] = bboxForSite(siteIcao);
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Source': 'level3-direct',
      'X-Site': siteIcao,
      'X-Product': product,
      'X-Bbox': `${w},${s},${e},${n}`,
    },
  });
}
