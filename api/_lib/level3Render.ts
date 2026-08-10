// Shared Level 3 fetch / parse / render for single-site and mosaic APIs.
// Injects N0C (product 161) into nexrad-level-3-data at runtime — the
// upstream package doesn't ship a definition, but N0C uses the same
// digital radial layout as N0Q.

import { createCanvas, type ImageData } from '@napi-rs/canvas';
import { createRequire } from 'node:module';
import { fillAnnularSector } from './polarRender.js';

const require = createRequire(import.meta.url);

const parseLevel3 = require('nexrad-level-3-data') as (
  file: Buffer,
  options?: { logger?: false | Console },
) => Level3Data;

const productsMod = require('nexrad-level-3-data/src/products') as {
  products: Record<string, unknown>;
  productAbbreviations: string[];
};
const { RandomAccessFile } = require(
  'nexrad-level-3-data/src/randomaccessfile',
) as {
  RandomAccessFile: new (data: Buffer) => {
    readShort: () => number;
    read: (n: number) => Buffer;
    readUShort: () => number;
  };
};

if (!productsMod.products['161']) {
  const deltaTime = (value: number) => ({
    deltaTime: (value & 0xffe0) >> 5,
    nonSupplementalScan: (value & 0x001f) === 0,
    sailsScan: (value & 0x001f) === 1,
    mrleScan: (value & 0x001f) === 2,
  });
  // Product 161 shares the digital dual-pol header layout with N0H (165)
  // for compression, but scaled values use the CC range 0.2–1.05.
  const halfwords30_53 = (data: Buffer) => {
    const raf = new RandomAccessFile(data);
    const elevationAngle = raf.readShort() / 10;
    raf.read(38); // dependent 31–49
    const dt = deltaTime(raf.readShort());
    const compressionMethod = raf.readShort();
    const uncompressedProductSize =
      (raf.readUShort() << 16) + raf.readUShort();
    return {
      elevationAngle,
      ...dt,
      compressionMethod,
      uncompressedProductSize,
      plot: {
        minimumDataValue: 0.2,
        dataIncrement: 1 / 300,
        dataLevels: 256,
      },
    };
  };
  productsMod.products['161'] = {
    code: 161,
    abbreviation: ['N0C', 'N1C', 'N2C', 'N3C'],
    description: 'Digital Correlation Coefficient',
    productDescription: { halfwords30_53 },
  };
  for (const ab of ['N0C', 'N1C', 'N2C', 'N3C']) {
    if (!productsMod.productAbbreviations.includes(ab)) {
      productsMod.productAbbreviations.push(ab);
    }
  }
}

export type L3ProductCode = 'N0S' | 'ROT' | 'N0C';

export interface Level3Radial {
  startAngle: number;
  angleDelta: number;
  bins: number[];
}

export interface Level3Packet {
  firstBin: number;
  numberBins: number;
  rangeScale: number;
  radials: Level3Radial[];
}

export interface Level3Data {
  textHeader?: { type?: string };
  productDescription?: {
    latitude?: number;
    longitude?: number;
    maxNegativeVelocity?: number;
    maxPositiveVelocity?: number;
    plot?: {
      minimumDataValue?: number;
      dataIncrement?: number;
      dataLevels?: number;
    };
  };
  radialPackets?: Level3Packet[];
}

export function siteCode(icao: string): string {
  const u = icao.toUpperCase();
  return u.startsWith('K') && u.length === 4 ? u.slice(1) : u;
}

export async function listLatestL3Key(
  site3: string,
  code: string,
): Promise<string | null> {
  const now = new Date();
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

function binToKnots(
  bin: number,
  maxNeg: number,
  maxPos: number,
): number | null {
  if (!bin || bin <= 0) return null;
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

function shearToColor(shear: number): [number, number, number, number] {
  const mag = Math.abs(shear);
  if (mag < 0.5) return [0, 0, 0, 0];
  const t = Math.min(1, mag / 20);
  if (shear > 0) {
    return [
      255,
      Math.round(220 * (1 - t)),
      Math.round(80 * t),
      Math.round(160 + 80 * t),
    ];
  }
  return [
    Math.round(40 * (1 - t)),
    Math.round(180 + 40 * t),
    255,
    Math.round(160 + 80 * t),
  ];
}

function ccColor(rho: number): [number, number, number, number] {
  if (Number.isNaN(rho) || rho < 0.3) return [0, 0, 0, 0];
  if (rho < 0.7) return [180, 0, 200, 220];
  if (rho < 0.85) return [220, 100, 0, 220];
  if (rho < 0.95) return [220, 220, 0, 200];
  return [80, 200, 80, 180];
}

function digitalBinToValue(
  bin: number,
  min: number,
  increment: number,
): number | null {
  if (bin == null || !Number.isFinite(bin) || bin <= 0) return null;
  // Parser may already have scaled digital levels into ρHV.
  if (bin <= 1.05) return bin < 0.3 ? null : bin;
  if (bin <= 1) return null;
  return min + (bin - 2) * increment;
}

export function parseL3Buffer(buffer: Buffer): Level3Data {
  return parseLevel3(buffer, { logger: false });
}

export function renderVelocityOrShearPng(
  packet: Level3Packet,
  maxNeg: number,
  maxPos: number,
  mode: 'velocity' | 'shear',
  size = 768,
): Buffer {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const imageData = ctx.createImageData(size, size) as unknown as ImageData;
  const pixels = imageData.data;

  const angles: number[] = [];
  const deltas: number[] = [];
  const field: (number | null)[][] = [];
  for (const radial of packet.radials) {
    angles.push(radial.startAngle);
    deltas.push(radial.angleDelta || 1);
    const row: (number | null)[] = [];
    for (let i = 0; i < packet.numberBins; i++) {
      row.push(binToKnots(radial.bins[i] ?? 0, maxNeg, maxPos));
    }
    field.push(row);
  }

  const n = field.length;
  const gateMeters = 1000 * (packet.rangeScale || 1);
  const maxRangeMeters = packet.numberBins * gateMeters;
  const metersPerPixel = (maxRangeMeters * 2) / size;
  const cx = size / 2;
  const cy = size / 2;
  const firstBinM = packet.firstBin * gateMeters;

  for (let ri = 0; ri < n; ri++) {
    const az0 = angles[ri];
    const az1 = az0 + deltas[ri];
    const next = field[(ri + 1) % n];
    const cur = field[ri];
    for (let gi = 0; gi < packet.numberBins; gi++) {
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
      const rInner = firstBinM + gi * gateMeters;
      const rOuter = firstBinM + (gi + 1) * gateMeters;
      fillAnnularSector(
        pixels,
        size,
        cx,
        cy,
        metersPerPixel,
        az0,
        az1,
        rInner,
        rOuter,
        rgba,
      );
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer('image/png');
}

export function renderCorrelationPng(
  packet: Level3Packet,
  min: number,
  increment: number,
  size = 768,
): Buffer {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const imageData = ctx.createImageData(size, size) as unknown as ImageData;
  const pixels = imageData.data;

  const n = packet.radials.length;
  const gateMeters = 1000 * (packet.rangeScale || 1);
  const maxRangeMeters = packet.numberBins * gateMeters;
  const metersPerPixel = (maxRangeMeters * 2) / size;
  const cx = size / 2;
  const cy = size / 2;
  const firstBinM = packet.firstBin * gateMeters;

  for (let ri = 0; ri < n; ri++) {
    const radial = packet.radials[ri];
    const az0 = radial.startAngle;
    const az1 = az0 + (radial.angleDelta || 1);
    for (let gi = 0; gi < packet.numberBins; gi++) {
      const rho = digitalBinToValue(radial.bins[gi] ?? 0, min, increment);
      if (rho == null) continue;
      const rInner = firstBinM + gi * gateMeters;
      const rOuter = firstBinM + (gi + 1) * gateMeters;
      fillAnnularSector(
        pixels,
        size,
        cx,
        cy,
        metersPerPixel,
        az0,
        az1,
        rInner,
        rOuter,
        ccColor(rho),
      );
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer('image/png');
}

/** Download + render one site's L3 product to a PNG buffer. */
export async function renderSiteL3(
  siteIcao: string,
  product: L3ProductCode,
  size = 384,
): Promise<Buffer | null> {
  const site3 = siteCode(siteIcao);
  const fetchCode = product === 'N0C' ? 'N0C' : 'N0S';
  const key = await listLatestL3Key(site3, fetchCode);
  if (!key) return null;
  const fileRes = await fetch(
    `https://unidata-nexrad-level3.s3.amazonaws.com/${key}`,
  );
  if (!fileRes.ok) return null;
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  let parsed: Level3Data;
  try {
    parsed = parseL3Buffer(buffer);
  } catch {
    return null;
  }
  const packet = parsed.radialPackets?.[0];
  if (!packet?.radials?.length) return null;

  if (product === 'N0C') {
    const plot = parsed.productDescription?.plot;
    const min = plot?.minimumDataValue ?? 0.2;
    const increment = plot?.dataIncrement ?? 0.00333;
    return renderCorrelationPng(packet, min, increment, size);
  }

  const maxNeg = parsed.productDescription?.maxNegativeVelocity ?? -60;
  const maxPos = parsed.productDescription?.maxPositiveVelocity ?? 60;
  return renderVelocityOrShearPng(
    packet,
    maxNeg,
    maxPos,
    product === 'ROT' ? 'shear' : 'velocity',
    size,
  );
}
