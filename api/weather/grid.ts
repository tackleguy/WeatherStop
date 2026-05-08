// Open-Meteo grid → forecast tile renderer. We don't have OpenWeatherMap
// (no API key) so wind/temp overlays are built server-side: sample an
// 8×8 grid of points across the requested slippy tile, batch them into
// one Open-Meteo /v1/forecast call, then bilinearly interpolate the
// values onto a 256² PNG.
//
// Each tile is 64 forecast points, so caching is the difference between
// "works fine" and "rate-limited in 30 seconds." We key the cache by
// {layer, z, x, y, 30-min-window} and store the rendered PNG in
// Vercel Blob with a 30-minute TTL — forecast-grade data doesn't change
// faster than that anyway.
//
//   /api/weather/grid?z=6&x=10&y=22&layer=wind|temperature

import { createCanvas } from '@napi-rs/canvas';
import { put, list } from '@vercel/blob';

export const config = {
  runtime: 'nodejs20.x',
  maxDuration: 25,
};

interface OpenMeteoCurrent {
  wind_speed_10m?: number;
  wind_direction_10m?: number;
  temperature_2m?: number;
}
interface OpenMeteoResponse {
  current?: OpenMeteoCurrent;
}

type Color = [number, number, number, number];

function tileBboxLngLat(
  z: number,
  x: number,
  y: number,
): { lonW: number; lonE: number; latN: number; latS: number } {
  const n = 2 ** z;
  const lonW = (x / n) * 360 - 180;
  const lonE = ((x + 1) / n) * 360 - 180;
  const latN = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const latS =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return { lonW, lonE, latN, latS };
}

function windColor(mph: number): Color {
  if (Number.isNaN(mph)) return [0, 0, 0, 0];
  const t = Math.min(1, Math.max(0, mph / 60));
  // Blue (calm) → green → yellow → orange → red (gale)
  if (t < 0.25) {
    return [
      Math.round(50 + t * 4 * 150),
      Math.round(80 + t * 4 * 120),
      200,
      180,
    ];
  }
  if (t < 0.5) {
    return [
      Math.round((t - 0.25) * 4 * 100),
      200,
      Math.round(200 - (t - 0.25) * 4 * 180),
      180,
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
  return [255, Math.round(50 - (t - 0.75) * 4 * 50), 0, 180];
}

function tempColor(f: number): Color {
  if (Number.isNaN(f)) return [0, 0, 0, 0];
  // -20°F (purple) → 120°F (magenta) — NWS-ish surface temp ramp.
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
    return [r, g, b, 180];
  }
  if (f >= stops[stops.length - 1][0]) {
    const [r, g, b] = stops[stops.length - 1][1];
    return [r, g, b, 180];
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
        180,
      ];
    }
  }
  return [0, 0, 0, 0];
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const zRaw = searchParams.get('z');
  const xRaw = searchParams.get('x');
  const yRaw = searchParams.get('y');
  const layer = searchParams.get('layer') ?? 'wind';

  if (!zRaw || !xRaw || !yRaw) {
    return new Response('missing z/x/y', { status: 400 });
  }
  if (layer !== 'wind' && layer !== 'temperature') {
    return new Response('invalid layer', { status: 400 });
  }
  const z = Number(zRaw);
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return new Response('bad z/x/y', { status: 400 });
  }
  // Don't try to render the entire planet from one tile — Open-Meteo
  // would just return garbage and we'd still pay 64 calls.
  if (z < 2 || z > 12) {
    return new Response('zoom out of range (2-12)', { status: 400 });
  }

  const win = Math.floor(Date.now() / (30 * 60_000));
  const cacheKey = `grid/${layer}/${z}/${x}/${y}/${win}.png`;

  try {
    const existing = await list({ prefix: cacheKey, limit: 1 });
    if (existing.blobs.length > 0) {
      return Response.redirect(existing.blobs[0].url, 302);
    }
  } catch {
    // Blob unavailable → fall through and render fresh.
  }

  const { lonW, lonE, latN, latS } = tileBboxLngLat(z, x, y);
  const GRID = 8;
  const points: Array<{ lat: number; lon: number }> = [];
  for (let iy = 0; iy < GRID; iy++) {
    for (let ix = 0; ix < GRID; ix++) {
      const lon = lonW + ((lonE - lonW) * (ix + 0.5)) / GRID;
      const lat = latN + ((latS - latN) * (iy + 0.5)) / GRID;
      points.push({ lat, lon });
    }
  }

  const lats = points.map((p) => p.lat.toFixed(3)).join(',');
  const lons = points.map((p) => p.lon.toFixed(3)).join(',');
  const fields =
    layer === 'wind'
      ? 'wind_speed_10m,wind_direction_10m'
      : 'temperature_2m';
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&current=${fields}&temperature_unit=fahrenheit&wind_speed_unit=mph`;

  let omResults: OpenMeteoResponse[];
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return new Response(`open-meteo ${res.status}`, { status: 502 });
    }
    const json = (await res.json()) as
      | OpenMeteoResponse
      | OpenMeteoResponse[];
    omResults = Array.isArray(json) ? json : [json];
  } catch {
    return new Response('open-meteo fetch failed', { status: 502 });
  }

  const SIZE = 256;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);

  const sample = (gridX: number, gridY: number): number => {
    const idx = gridY * GRID + gridX;
    const r = omResults[idx]?.current;
    if (!r) return Number.NaN;
    if (layer === 'wind') {
      return typeof r.wind_speed_10m === 'number' ? r.wind_speed_10m : Number.NaN;
    }
    return typeof r.temperature_2m === 'number' ? r.temperature_2m : Number.NaN;
  };

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const gx = (px / SIZE) * (GRID - 1);
      const gy = (py / SIZE) * (GRID - 1);
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const x1 = Math.min(x0 + 1, GRID - 1);
      const y1 = Math.min(y0 + 1, GRID - 1);
      const fx = gx - x0;
      const fy = gy - y0;

      const v00 = sample(x0, y0);
      const v10 = sample(x1, y0);
      const v01 = sample(x0, y1);
      const v11 = sample(x1, y1);
      const value =
        v00 * (1 - fx) * (1 - fy) +
        v10 * fx * (1 - fy) +
        v01 * (1 - fx) * fy +
        v11 * fx * fy;

      const [r, g, b, a] =
        layer === 'wind' ? windColor(value) : tempColor(value);
      const i = (py * SIZE + px) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const png = canvas.toBuffer('image/png');

  try {
    const blob = await put(cacheKey, png, {
      access: 'public',
      contentType: 'image/png',
      cacheControlMaxAge: 1800,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return Response.redirect(blob.url, 302);
  } catch {
    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=1800',
        'X-Source': 'open-meteo-grid-direct',
      },
    });
  }
}
