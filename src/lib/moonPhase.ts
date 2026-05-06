// Moon phase + illumination from a Date. Uses Conway's approximation
// for the synodic period, which is accurate to within ~0.5 days for
// any date within the 20th-21st century — plenty for a UI affordance.
//
// We render eight named phases (the cardinal four plus the four
// crescent / gibbous variants) plus an illumination percent (0-100).

export interface MoonPhase {
  /** Days since the last new moon, modulo synodic period. */
  age: number;
  /** Synodic-period fraction, 0 (new) → 0.5 (full) → ~1 (next new). */
  phase: number;
  /** Illumination 0-100. */
  illumination: number;
  /** Named phase. */
  name:
    | 'New Moon'
    | 'Waxing Crescent'
    | 'First Quarter'
    | 'Waxing Gibbous'
    | 'Full Moon'
    | 'Waning Gibbous'
    | 'Last Quarter'
    | 'Waning Crescent';
  /** Single emoji glyph, useful for tight UI. */
  emoji: string;
  /** Hours until the next major phase (new / first / full / last). */
  hoursToNext: number;
}

const SYNODIC_DAYS = 29.530588853;

function julianDay(date: Date): number {
  // JS Date#getTime() is ms since Unix epoch; convert to JD.
  return date.getTime() / 86_400_000 + 2440587.5;
}

function normalizePhase(p: number): number {
  let v = p % 1;
  if (v < 0) v += 1;
  return v;
}

export function moonPhaseFor(date: Date = new Date()): MoonPhase {
  // Reference new moon at JD 2451550.1 (2000-01-06 18:14 UT).
  const jd = julianDay(date);
  const phase = normalizePhase((jd - 2451550.1) / SYNODIC_DAYS);
  const age = phase * SYNODIC_DAYS;

  // Illumination is symmetric around full (0.5).
  const illumination = Math.round((1 - Math.cos(2 * Math.PI * phase)) * 50);

  const { name, emoji } = labelFor(phase);

  // Distance to the next cardinal phase boundary (0 / 0.25 / 0.5 / 0.75).
  const targets = [0.25, 0.5, 0.75, 1];
  let nextBoundary = targets.find((t) => t > phase) ?? 1;
  const fractionRemaining = nextBoundary - phase;
  const hoursToNext = +(fractionRemaining * SYNODIC_DAYS * 24).toFixed(1);

  return { age, phase, illumination, name, emoji, hoursToNext };
}

function labelFor(phase: number): { name: MoonPhase['name']; emoji: string } {
  // Tight windows around the cardinal points (~1/30th of the synodic
  // period) so we report "New" / "First Quarter" / etc. only when the
  // moon is genuinely close to that boundary.
  const W = 1 / 30;
  if (phase < W || phase > 1 - W) return { name: 'New Moon', emoji: '🌑' };
  if (Math.abs(phase - 0.25) < W) return { name: 'First Quarter', emoji: '🌓' };
  if (Math.abs(phase - 0.5) < W) return { name: 'Full Moon', emoji: '🌕' };
  if (Math.abs(phase - 0.75) < W) return { name: 'Last Quarter', emoji: '🌗' };

  if (phase < 0.25) return { name: 'Waxing Crescent', emoji: '🌒' };
  if (phase < 0.5) return { name: 'Waxing Gibbous', emoji: '🌔' };
  if (phase < 0.75) return { name: 'Waning Gibbous', emoji: '🌖' };
  return { name: 'Waning Crescent', emoji: '🌘' };
}

// Pure-SVG moon icon at any size. We keep this here (instead of in
// components/) so it's a pure helper with no React imports — the card
// renders it via dangerouslySetInnerHTML or a tiny wrapper component.
//
// The illuminated terminator is drawn as an ellipse subtraction:
// for waxing phases the right side is lit; for waning phases the left.
export interface MoonSVGOptions {
  size?: number;
  litColor?: string;
  darkColor?: string;
  outlineColor?: string;
  background?: string;
}

export function moonSVG(date: Date, opts: MoonSVGOptions = {}): string {
  const { phase } = moonPhaseFor(date);
  const size = opts.size ?? 80;
  const lit = opts.litColor ?? '#f8fafc';
  const dark = opts.darkColor ?? '#0f172a';
  const outline = opts.outlineColor ?? 'rgba(255,255,255,0.18)';
  const bg = opts.background ?? 'transparent';

  const r = (size - 4) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // Compute terminator ellipse semi-minor axis. cos goes 1 → -1 across
  // the synodic period; positive means waxing, negative waning.
  const cosPhase = Math.cos(2 * Math.PI * phase);
  const k = Math.abs(cosPhase) * r;
  const waxing = phase < 0.5;

  const halfMaskId = 'm' + Math.floor(phase * 1e6).toString(36);

  // Two arcs build the lit half: the outer circle minus an inner ellipse
  // that defines the terminator's curve.
  const arcDir = waxing ? 1 : 0;

  const litPath = `
    M ${cx} ${cy - r}
    A ${r} ${r} 0 0 ${arcDir} ${cx} ${cy + r}
    A ${k} ${r} 0 0 ${cosPhase < 0 ? arcDir : 1 - arcDir} ${cx} ${cy - r}
    Z
  `;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="mg-${halfMaskId}" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="${lit}"/>
      <stop offset="80%" stop-color="${lit}" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="${lit}" stop-opacity="0.65"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${dark}" stroke="${outline}" stroke-width="1"/>
  <path d="${litPath.trim()}" fill="url(#mg-${halfMaskId})"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${outline}" stroke-width="1"/>
</svg>`.trim();
}

// Convenience: returns a localized "next event" sentence for the card
// footer. We pick the nearest of {next new / first / full / last} so the
// copy reads naturally regardless of where in the cycle we are.
export function nextMoonEventSentence(date: Date = new Date()): string {
  const { phase, hoursToNext } = moonPhaseFor(date);
  const targets: Array<{ at: number; label: string }> = [
    { at: 0, label: 'New Moon' },
    { at: 0.25, label: 'First Quarter' },
    { at: 0.5, label: 'Full Moon' },
    { at: 0.75, label: 'Last Quarter' },
    { at: 1, label: 'New Moon' },
  ];
  const next = targets.find((t) => t.at > phase) ?? targets[targets.length - 1];

  const days = hoursToNext / 24;
  if (days < 1) {
    const h = Math.max(1, Math.round(hoursToNext));
    return `${next.label} in ${h}h`;
  }
  return `${next.label} in ${Math.round(days)}d`;
}
