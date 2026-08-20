// Seamless viewport forecast field (MIT app code + Open-Meteo data).
// One georeferenced PNG for the whole map — no slippy-tile seams that
// made wind/temp look boxy. Used for wind, temperature, and rain forecast.
//
//   /api/weather/field?layer=wind|temperature|precipitation
//     &bbox=west,south,east,north&width=1024&height=640[&time=ISO-hour]

import { createCanvas } from '@napi-rs/canvas';
import { put, list } from '@vercel/blob';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

type Layer = 'wind' | 'temperature' | 'precipitation';
type Color = [number, number, number, number];

interface OpenMeteoHourly {
  time?: string[];
  wind_speed_10m?: (number | null)[];
  wind_direction_10m?: (number | null)[];
  temperature_2m?: (number | null)[];
  precipitation?: (number | null)[];
}
interface OpenMeteoCurrent {
  wind_speed_10m?: number;
  wind_direction_10m?: number;
  temperature_2m?: number;
  precipitation?: number;
}
interface OpenMeteoResponse {
  current?: OpenMeteoCurrent;
  hourly?: OpenMeteoHourly;
}

function hourKey(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return (
    `${d.getUTCFullYear()}-` +
    `${String(d.getUTCMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getUTCDate()).padStart(2, '0')}T` +
    `${String(d.getUTCHours()).padStart(2, '0')}:00`
  );
}

function windColor(mph: number): Color {
  if (!Number.isFinite(mph)) return [0, 0, 0, 0];
  const t = Math.min(1, Math.max(0, mph / 60));
  if (t < 0.25) {
    return [
      Math.round(50 + t * 4 * 150),
      Math.round(80 + t * 4 * 120),
      200,
      170,
    ];
  }
  if (t < 0.5) {
    return [
      Math.round((t - 0.25) * 4 * 100),
      200,
      Math.round(200 - (t - 0.25) * 4 * 180),
      175,
    ];
  }
  if (t < 0.75) {
    return [
      Math.round(100 + (t - 0.5) * 4 * 155),
      Math.round(200 - (t - 0.5) * 4 * 150),
      0,
      180,
    ];
  }
  return [255, Math.round(50 - (t - 0.75) * 4 * 50), 0, 185];
}

function tempColor(f: number): Color {
  if (!Number.isFinite(f)) return [0, 0, 0, 0];
  const stops: Array<[number, [number, number, number]]> = [
    [-20, [128, 0, 192]],
    [0, [50, 100, 220]],
    [32, [100, 200, 240]],
    [60, [80, 200, 100]],
    [80, [255, 220, 60]],
    [100, [240, 80, 60]],
    [120, [240, 80, 200]],
  ];
  if (f <= stops[0][0]) {
    const [r, g, b] = stops[0][1];
    return [r, g, b, 170];
  }
  if (f >= stops[stops.length - 1][0]) {
    const [r, g, b] = stops[stops.length - 1][1];
    return [r, g, b, 170];
  }
  for (let i = 0; i < stops.length - 1; i++) {
    if (f >= stops[i][0] && f <= stops[i + 1][0]) {
      const t = (f - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      const [r0, g0, b0] = stops[i][1];
      const [r1, g1, b1] = stops[i + 1][1];
      return [
        Math.round(r0 + (r1 - r0) * t),
        Math.round(g0 + (g1 - g0) * t),
        Math.round(b0 + (b1 - b0) * t),
        170,
      ];
    }
  }
  return [0, 0, 0, 0];
}

/** Rain rate (in/h) — transparent when dry. */
function precipColor(inch: number): Color {
  if (!Number.isFinite(inch) || inch < 0.005) return [0, 0, 0, 0];
  const t = Math.min(1, Math.max(0, Math.log10(1 + inch * 40) / Math.log10(21)));
  if (t < 0.33) {
    const u = t / 0.33;
    return [
      Math.round(40 + u * 40),
      Math.round(120 + u * 80),
      Math.round(220 - u * 40),
      Math.round(40 + u * 100),
    ];
  }
  if (t < 0.66) {
    const u = (t - 0.33) / 0.33;
    return [
      Math.round(80 + u * 100),
      Math.round(200 - u * 40),
      Math.round(180 - u * 120),
      Math.round(140 + u * 30),
    ];
  }
  const u = (t - 0.66) / 0.34;
  return [
    Math.round(180 + u * 75),
    Math.round(160 - u * 120),
    Math.round(60 - u * 40),
    Math.round(170 + u * 40),
  ];
}

function valueFrom(
  r: OpenMeteoResponse | undefined,
  layer: Layer,
  hour: string | null,
): number {
  if (!r) return Number.NaN;
  if (hour && r.hourly?.time?.length) {
    const idx = r.hourly.time.findIndex((t) => t.startsWith(hour));
    const i = idx >= 0 ? idx : 0;
    if (layer === 'wind') {
      const v = r.hourly.wind_speed_10m?.[i];
      return typeof v === 'number' ? v : Number.NaN;
    }
    if (layer === 'precipitation') {
      const v = r.hourly.precipitation?.[i];
      return typeof v === 'number' ? v : Number.NaN;
    }
    const v = r.hourly.temperature_2m?.[i];
    return typeof v === 'number' ? v : Number.NaN;
  }
  const c = r.current;
  if (!c) return Number.NaN;
  if (layer === 'wind') {
    return typeof c.wind_speed_10m === 'number' ? c.wind_speed_10m : Number.NaN;
  }
  if (layer === 'precipitation') {
    return typeof c.precipitation === 'number' ? c.precipitation : Number.NaN;
  }
  return typeof c.temperature_2m === 'number' ? c.temperature_2m : Number.NaN;
}

function colorFor(layer: Layer, v: number): Color {
  if (layer === 'temperature') return tempColor(v);
  if (layer === 'precipitation') return precipColor(v);
  return windColor(v);
}

/** Soft blur so bilinear sample cells don't read as a mosaic. */
function softBlur(
  src: Uint8ClampedArray,
  w: number,
  h: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          const i = (yy * w + xx) * 4;
          const weight = dx === 0 && dy === 0 ? 4 : 1;
          r += src[i] * weight;
          g += src[i + 1] * weight;
          b += src[i + 2] * weight;
          a += src[i + 3] * weight;
          n += weight;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url, 'https://x');
  const layerRaw = searchParams.get('layer') ?? 'wind';
  const layer: Layer =
    layerRaw === 'temperature' || layerRaw === 'precipitation'
      ? layerRaw
      : 'wind';
  const bboxRaw = searchParams.get('bbox');
  const hour = hourKey(searchParams.get('time'));
  const width = Math.min(
    1536,
    Math.max(256, Number(searchParams.get('width') ?? 1024) || 1024),
  );
  const height = Math.min(
    1024,
    Math.max(192, Number(searchParams.get('height') ?? 640) || 640),
  );

  if (!bboxRaw) return new Response('missing bbox', { status: 400 });
  const parts = bboxRaw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return new Response('bad bbox', { status: 400 });
  }
  let [west, south, east, north] = parts;
  if (east < west) [west, east] = [east, west];
  if (north < south) [south, north] = [north, south];
  // Guard absurd world-spanning requests.
  if (east - west > 120 || north - south > 80) {
    return new Response('bbox too large', { status: 400 });
  }

  const win = hour ?? `live-${Math.floor(Date.now() / (30 * 60_000))}`;
  const cacheKey = `field/${layer}/${west.toFixed(2)}_${south.toFixed(2)}_${east.toFixed(2)}_${north.toFixed(2)}_${width}x${height}/${win}.png`;
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (hasBlob) {
    try {
      const existing = await list({ prefix: cacheKey, limit: 1 });
      if (existing.blobs.length > 0) {
        const upstream = await fetch(existing.blobs[0].url);
        if (upstream.ok) {
          return new Response(upstream.body, {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=900',
              'X-Source': 'open-meteo-field-blob',
            },
          });
        }
      }
    } catch {
      // fall through
    }
  }

  // Dense enough for smooth bilinear; under Open-Meteo's multi-point cap.
  const COLS = 24;
  const ROWS = 16;
  const points: Array<{ lat: number; lon: number }> = [];
  for (let iy = 0; iy < ROWS; iy++) {
    for (let ix = 0; ix < COLS; ix++) {
      const lon = west + ((east - west) * (ix + 0.5)) / COLS;
      const lat = north + ((south - north) * (iy + 0.5)) / ROWS;
      points.push({ lat, lon });
    }
  }

  const lats = points.map((p) => p.lat.toFixed(3)).join(',');
  const lons = points.map((p) => p.lon.toFixed(3)).join(',');
  const fields =
    layer === 'wind'
      ? 'wind_speed_10m,wind_direction_10m'
      : layer === 'precipitation'
        ? 'precipitation'
        : 'temperature_2m';

  let url: string;
  if (hour) {
    url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
      `&hourly=${fields}&start_hour=${encodeURIComponent(hour)}` +
      `&end_hour=${encodeURIComponent(hour)}` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph` +
      `&precipitation_unit=inch&timezone=UTC`;
  } else {
    url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
      `&current=${fields}&temperature_unit=fahrenheit&wind_speed_unit=mph` +
      `&precipitation_unit=inch`;
  }

  let omResults: OpenMeteoResponse[];
  try {
    let res: Response | null = null;
    for (let i = 0; i < 3; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 500 * i));
      try {
        res = await fetch(url);
        if (res.ok) break;
        if (res.status < 500) break;
        res = null;
      } catch {
        res = null;
      }
    }
    if (!res || !res.ok) {
      return new Response(`open-meteo ${res?.status ?? 'timeout'}`, { status: 502 });
    }
    const json = (await res.json()) as
      | OpenMeteoResponse
      | OpenMeteoResponse[];
    omResults = Array.isArray(json) ? json : [json];
  } catch {
    return new Response('open-meteo fetch failed', { status: 502 });
  }

  const sample = (gx: number, gy: number): number =>
    valueFrom(omResults[gy * COLS + gx], layer, hour);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const gx = (px / width) * (COLS - 1);
      const gy = (py / height) * (ROWS - 1);
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const x1 = Math.min(x0 + 1, COLS - 1);
      const y1 = Math.min(y0 + 1, ROWS - 1);
      const fx = gx - x0;
      const fy = gy - y0;
      // Smoothstep — softer than raw bilinear.
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const v00 = sample(x0, y0);
      const v10 = sample(x1, y0);
      const v01 = sample(x0, y1);
      const v11 = sample(x1, y1);
      const value =
        v00 * (1 - sx) * (1 - sy) +
        v10 * sx * (1 - sy) +
        v01 * (1 - sx) * sy +
        v11 * sx * sy;
      const [r, g, b, a] = colorFor(layer, value);
      const i = (py * width + px) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = a;
    }
  }

  // Two soft passes kill residual cell edges.
  const blurred = softBlur(
    softBlur(img.data as unknown as Uint8ClampedArray, width, height),
    width,
    height,
  );
  img.data.set(blurred);
  ctx.putImageData(img, 0, 0);
  const png = canvas.toBuffer('image/png');

  if (hasBlob) {
    try {
      await put(cacheKey, png, {
        access: 'public',
        contentType: 'image/png',
        cacheControlMaxAge: 900,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
    } catch {
      // best-effort
    }
  }

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=900',
      'X-Source': 'open-meteo-field',
      'X-License': 'App MIT; data Open-Meteo (CC BY 4.0)',
    },
  });
}
