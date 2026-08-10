// Deep links into earth.nullschool.net (Nullschool Technologies).
// The live Earth app is proprietary — we only build URLs / embed; we do
// not redistribute their code. Contact inquiries@nullschool.net for
// commercial licensing of the visualization itself.

import type { ProductId } from '../constants/products';

export type NullschoolMode = 'wind' | 'temp' | 'precip';

export function nullschoolModeForProduct(
  product: ProductId,
): NullschoolMode | null {
  if (product === 'wind') return 'wind';
  if (product === 'temperature') return 'temp';
  if (product === 'rain-forecast') return 'precip';
  return null;
}

/** MapLibre zoom → Nullschool orthographic altitude (higher = closer). */
export function zoomToNullschoolAltitude(zoom: number): number {
  const z = Number.isFinite(zoom) ? zoom : 4;
  return Math.round(
    Math.min(8192, Math.max(300, 256 * Math.pow(2, Math.max(0, z - 2)))),
  );
}

/** GFS on Nullschool is 3-hourly; snap unix seconds to that cadence. */
export function nullschoolTimeStamp(unixSec: number, nowSec = Date.now() / 1000): string {
  const threeH = 3 * 3600;
  const snapped = Math.floor(unixSec / threeH) * threeH;
  // Within ~90 minutes of "now" → live/current catalog entry.
  if (Math.abs(snapped - nowSec) < 90 * 60) return 'current';
  const d = new Date(snapped * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  return `${y}/${m}/${day}/${h}00Z`;
}

/**
 * Build an earth.nullschool.net hash URL for the given mode + view.
 *
 * Examples:
 *   #current/wind/surface/level/orthographic=-97.00,39.00,1024
 *   #current/wind/surface/level/overlay=temp/orthographic=-97.00,39.00,1024
 */
export function buildNullschoolUrl(opts: {
  mode: NullschoolMode;
  lon: number;
  lat: number;
  zoom?: number;
  unixSec?: number;
}): string {
  const lon = clamp(opts.lon, -180, 180);
  const lat = clamp(opts.lat, -90, 90);
  const altitude = zoomToNullschoolAltitude(opts.zoom ?? 4);
  const time =
    opts.unixSec !== undefined
      ? nullschoolTimeStamp(opts.unixSec)
      : 'current';

  let path: string;
  if (opts.mode === 'temp') {
    path = `${time}/wind/surface/level/overlay=temp`;
  } else if (opts.mode === 'precip') {
    // 3-hour precip accumulation — closest Nullschool rain forecast layer.
    path = `${time}/wind/surface/level/overlay=precip_3hr`;
  } else {
    path = `${time}/wind/surface/level`;
  }

  const ortho = `orthographic=${lon.toFixed(2)},${lat.toFixed(2)},${altitude}`;
  return `https://earth.nullschool.net/#${path}/${ortho}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
