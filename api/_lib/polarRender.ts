// Polar → cartesian render used by NEXRAD L2/L3 PNGs.
// Pixel-centric fill (every pixel sampled) — no pinholes like splat/wedge
// sampling. Matches the “smooth solid disc” look of WeatherWise / GR2-style
// viewers while staying on the server PNG path.

export type Rgba = [number, number, number, number];

export interface PolarField {
  /** Radar azimuths in degrees (0 = north, clockwise), one per radial. */
  anglesDeg: number[];
  /** values[radial][gate] — null/undefined = no echo. */
  values: (number | null | undefined)[][];
  gateSizeM: number;
  firstGateM: number;
  maxRangeM: number;
  colorFor: (value: number) => Rgba;
}

/**
 * Render a polar field into RGBA ImageData (size × size).
 * For each pixel: convert to range/azimuth, pick nearest radial + gate.
 */
export function renderPolarToImageData(
  size: number,
  field: PolarField,
  pixels: Uint8ClampedArray | Buffer,
): void {
  const n = field.anglesDeg.length;
  if (n === 0) return;

  const cx = size / 2;
  const cy = size / 2;
  const metersPerPixel = (field.maxRangeM * 2) / size;
  const maxRPx = size / 2;

  // Normalize angles to [0, 360) and build a lookup by rounded degree for O(1).
  const angleLookup = new Int16Array(360);
  angleLookup.fill(-1);
  const normAngles = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let a = field.anglesDeg[i] % 360;
    if (a < 0) a += 360;
    normAngles[i] = a;
    angleLookup[Math.round(a) % 360] = i;
  }
  // Fill gaps in the 360° lookup with nearest radial index.
  let last = 0;
  for (let d = 0; d < 360; d++) {
    if (angleLookup[d] >= 0) last = angleLookup[d];
    else angleLookup[d] = last;
  }
  // Second pass backward so early gaps get a valid neighbor too.
  for (let d = 359; d >= 0; d--) {
    if (angleLookup[d] >= 0) last = angleLookup[d];
    else angleLookup[d] = last;
  }

  const gateSizeM = Math.max(1, field.gateSizeM);
  const firstGateM = Math.max(0, field.firstGateM);

  for (let py = 0; py < size; py++) {
    const dy = py - cy + 0.5;
    for (let px = 0; px < size; px++) {
      const dx = px - cx + 0.5;
      const rPx = Math.hypot(dx, dy);
      if (rPx > maxRPx) continue;

      const rangeM = rPx * metersPerPixel;
      if (rangeM < firstGateM || rangeM > field.maxRangeM) continue;

      const gate = Math.floor((rangeM - firstGateM) / gateSizeM);
      if (gate < 0) continue;

      // Math atan2: 0 = east, CCW. Radar azimuth 0 = north, clockwise.
      // Match existing convention: azRad = (azDeg - 90) * PI/180
      // ⇒ azDeg = atan2(dy,dx)*180/PI + 90
      let azDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (azDeg < 0) azDeg += 360;
      if (azDeg >= 360) azDeg -= 360;

      const ri = angleLookup[Math.round(azDeg) % 360];
      if (ri < 0) continue;
      const row = field.values[ri];
      if (!row || gate >= row.length) continue;
      const v = row[gate];
      if (v == null || Number.isNaN(v as number)) continue;

      const [cr, cg, cb, ca] = field.colorFor(v as number);
      if (ca <= 0) continue;
      const idx = (py * size + px) * 4;
      pixels[idx] = cr;
      pixels[idx + 1] = cg;
      pixels[idx + 2] = cb;
      pixels[idx + 3] = ca;
    }
  }
}

/** @deprecated Prefer renderPolarToImageData — kept for any wedge callers. */
export function fillAnnularSector(
  pixels: Uint8ClampedArray | Buffer,
  size: number,
  cx: number,
  cy: number,
  metersPerPixel: number,
  az0Deg: number,
  az1Deg: number,
  rInnerM: number,
  rOuterM: number,
  rgba: Rgba,
): void {
  if (rOuterM <= 0 || rOuterM <= rInnerM) return;

  let a0 = ((az0Deg - 90) * Math.PI) / 180;
  let a1 = ((az1Deg - 90) * Math.PI) / 180;
  let dA = a1 - a0;
  while (dA > Math.PI) dA -= Math.PI * 2;
  while (dA < -Math.PI) dA += Math.PI * 2;
  if (Math.abs(dA) < 1e-6) dA = (1 * Math.PI) / 180;

  const r0 = Math.max(0, rInnerM) / metersPerPixel;
  const r1 = rOuterM / metersPerPixel;
  const pad = 1;
  const cos0 = Math.cos(a0);
  const sin0 = Math.sin(a0);
  const cos1 = Math.cos(a0 + dA);
  const sin1 = Math.sin(a0 + dA);
  const xs = [cx + r0 * cos0, cx + r1 * cos0, cx + r0 * cos1, cx + r1 * cos1];
  const ys = [cy + r0 * sin0, cy + r1 * sin0, cy + r0 * sin1, cy + r1 * sin1];
  const xmin = Math.max(0, Math.floor(Math.min(...xs) - pad));
  const xmax = Math.min(size - 1, Math.ceil(Math.max(...xs) + pad));
  const ymin = Math.max(0, Math.floor(Math.min(...ys) - pad));
  const ymax = Math.min(size - 1, Math.ceil(Math.max(...ys) + pad));

  const [cr, cg, cb, ca] = rgba;
  const aStart = a0;
  const aEnd = a0 + dA;
  const aLo = Math.min(aStart, aEnd);
  const aHi = Math.max(aStart, aEnd);

  for (let py = ymin; py <= ymax; py++) {
    const dy = py - cy + 0.5;
    for (let px = xmin; px <= xmax; px++) {
      const dx = px - cx + 0.5;
      const r = Math.hypot(dx, dy);
      if (r < r0 || r > r1) continue;
      let ang = Math.atan2(dy, dx);
      // Normalize into continuous interval covering [aLo, aHi]
      while (ang < aLo - Math.PI) ang += Math.PI * 2;
      while (ang > aHi + Math.PI) ang -= Math.PI * 2;
      if (ang < aLo - 1e-6 || ang > aHi + 1e-6) continue;
      const idx = (py * size + px) * 4;
      pixels[idx] = cr;
      pixels[idx + 1] = cg;
      pixels[idx + 2] = cb;
      pixels[idx + 3] = ca;
    }
  }
}
