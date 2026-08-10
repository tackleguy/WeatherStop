// Shared polar → cartesian fill for NEXRAD L2/L3 PNGs.
// Avoids the old "2×2 splat every other gate" look that made velocity
// and dual-pol products look dotted when zoomed in.

export type Rgba = [number, number, number, number];

/** Paint a filled annular sector (gate × radial wedge) into an ImageData buffer. */
export function fillAnnularSector(
  pixels: Uint8ClampedArray | Buffer,
  size: number,
  cx: number,
  cy: number,
  metersPerPixel: number,
  /** Radar azimuth degrees (0 = north, clockwise). */
  az0Deg: number,
  az1Deg: number,
  rInnerM: number,
  rOuterM: number,
  rgba: Rgba,
): void {
  if (rOuterM <= 0 || rOuterM <= rInnerM) return;

  // Math angle: 0° east, CCW — matches existing L2/L3 splat convention.
  let a0 = ((az0Deg - 90) * Math.PI) / 180;
  let a1 = ((az1Deg - 90) * Math.PI) / 180;
  let dA = a1 - a0;
  while (dA > Math.PI) dA -= Math.PI * 2;
  while (dA < -Math.PI) dA += Math.PI * 2;
  if (Math.abs(dA) < 1e-6) dA = (1 * Math.PI) / 180; // 1° minimum wedge

  const rMax = rOuterM / metersPerPixel;
  // Angular samples dense enough that consecutive rays are ≤1 px apart at rMax.
  const angSteps = Math.max(1, Math.ceil(Math.abs(dA) * rMax));
  const radSteps = Math.max(
    1,
    Math.ceil((rOuterM - Math.max(0, rInnerM)) / metersPerPixel),
  );

  const [cr, cg, cb, ca] = rgba;
  for (let s = 0; s <= angSteps; s++) {
    const t = s / angSteps;
    const az = a0 + dA * t;
    const cos = Math.cos(az);
    const sin = Math.sin(az);
    for (let rs = 0; rs <= radSteps; rs++) {
      const u = rs / radSteps;
      const r = Math.max(0, rInnerM) + (rOuterM - Math.max(0, rInnerM)) * u;
      const px = Math.round(cx + (r * cos) / metersPerPixel);
      const py = Math.round(cy + (r * sin) / metersPerPixel);
      if (px < 0 || px >= size || py < 0 || py >= size) continue;
      const idx = (py * size + px) * 4;
      pixels[idx] = cr;
      pixels[idx + 1] = cg;
      pixels[idx + 2] = cb;
      pixels[idx + 3] = ca;
    }
  }
}
