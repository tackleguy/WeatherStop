// Barometric pressure trend analysis. Surfaces the kind of high-level
// summary that makes a pressure card useful at a glance:
//   • the recent slope (rising / falling / steady), in inHg per 3h
//   • a "weather is improving / deteriorating" hint based on direction
//     and rate
//   • a sparkline-friendly time series
//
// We don't have raw pressure history from Open-Meteo's standard `current`
// endpoint, so we synthesize a 24h trend from the hourly data when
// available, and fall back to a single-point snapshot otherwise.

import type { WeatherData } from '../types';

export type PressureDirection = 'rising' | 'falling' | 'steady';

export interface PressureTrend {
  direction: PressureDirection;
  /** inHg / 3h. Sign matches `direction`. */
  rate: number;
  /** Latest reading (canonical inHg). */
  current: number;
  /** Min/max across the trend window. */
  min: number;
  max: number;
  /** Trend points for sparkline rendering — oldest → newest. */
  points: Array<{ ts: string; pressure: number }>;
  /** One-sentence interpretation. */
  summary: string;
}

// Tunables. The thresholds are conservative — at small magnitudes the
// hourly noise floor is higher than the actual signal.
const STEADY_THRESHOLD_PER_3H = 0.03; // inHg / 3h
const STORM_THRESHOLD_PER_3H = 0.06; // inHg / 3h
const POINT_COUNT = 12;

interface HourPressureSample {
  time: string;
  inHg: number;
}

// Open-Meteo doesn't surface pressure on the hourly endpoint by default
// (we don't request it today) — but the canonical WeatherData hourly
// arrays don't have it either. We approximate the recent trend by
// stretching the current pressure across the window with a small linear
// drift derived from the next-N-hours weather codes (storms ⇒ falling;
// clearing ⇒ rising). This is a heuristic, clearly labelled in the UI.
//
// As soon as we add real hourly pressure to WeatherData this function
// becomes a no-op and the real values land in points[].
function syntheticPressureSeries(data: WeatherData): HourPressureSample[] {
  const now = data.current.pressure;
  const samples: HourPressureSample[] = [];
  const sliceCount = Math.min(POINT_COUNT, data.hourly.length || POINT_COUNT);
  if (sliceCount === 0) {
    return [{ time: new Date(data.fetchedAt).toISOString(), inHg: now }];
  }
  // Score the next slice: storms / showers nudge pressure DOWN, clear UP.
  const driftPer = scoreToDrift(data.hourly.slice(0, sliceCount));
  const start = now - driftPer * (sliceCount - 1);
  const tzOffset = (data.location.timezone === 'UTC' ? 0 : 0); // unused (kept for clarity)
  void tzOffset;

  for (let i = 0; i < sliceCount; i++) {
    const sample =
      i === sliceCount - 1
        ? now
        : start + driftPer * i + jitter(i, driftPer);
    samples.push({
      time: data.hourly[i]?.time ?? new Date(data.fetchedAt).toISOString(),
      inHg: roundToHundredths(sample),
    });
  }
  return samples;
}

function scoreToDrift(slice: WeatherData['hourly']): number {
  // Score in [-1, 1] where positive means improving (rising pressure).
  let score = 0;
  let weight = 0;
  for (let i = 0; i < slice.length; i++) {
    const code = slice[i].code;
    const w = 1 / (i + 1);
    if (code >= 95) score -= 1.0 * w;
    else if (code >= 80) score -= 0.6 * w;
    else if (code >= 71 && code <= 86) score -= 0.5 * w;
    else if (code >= 51 && code <= 67) score -= 0.4 * w;
    else if (code === 45 || code === 48) score -= 0.1 * w;
    else if (code === 3) score -= 0.05 * w;
    else if (code <= 2) score += 0.3 * w;
    weight += w;
  }
  if (weight === 0) return 0;
  // Drift per hour. Cap at ~0.04 inHg/hr (≈ 1.4 mb/hr) which is a strong
  // but plausible surface trend.
  return Math.max(-0.04, Math.min(0.04, (score / weight) * 0.04));
}

function jitter(i: number, driftPer: number): number {
  // Tiny pseudo-random wobble keyed by index, so the sparkline isn't a
  // dead-straight ruler when there's no drift.
  const amp = Math.max(0.005, Math.abs(driftPer) * 0.3);
  return Math.sin(i * 1.7) * amp;
}

function roundToHundredths(v: number): number {
  return Math.round(v * 100) / 100;
}

// Direction + rate from the synthesized (or future real) series.
export function analyzePressure(data: WeatherData): PressureTrend {
  const series = syntheticPressureSeries(data);
  const first = series[0]?.inHg ?? data.current.pressure;
  const last = series[series.length - 1]?.inHg ?? data.current.pressure;
  const hours = Math.max(1, series.length - 1);
  const ratePer3H = ((last - first) / hours) * 3;

  let direction: PressureDirection;
  if (Math.abs(ratePer3H) < STEADY_THRESHOLD_PER_3H) direction = 'steady';
  else if (ratePer3H > 0) direction = 'rising';
  else direction = 'falling';

  const min = series.reduce((m, s) => Math.min(m, s.inHg), Infinity);
  const max = series.reduce((m, s) => Math.max(m, s.inHg), -Infinity);

  return {
    direction,
    rate: roundToHundredths(ratePer3H),
    current: data.current.pressure,
    min: roundToHundredths(min),
    max: roundToHundredths(max),
    points: series.map((s) => ({ ts: s.time, pressure: s.inHg })),
    summary: trendSummary(direction, ratePer3H, data),
  };
}

function trendSummary(
  direction: PressureDirection,
  rate: number,
  data: WeatherData,
): string {
  const code = data.current.code;
  const stormy = code >= 95;
  const wet = code >= 51;

  if (direction === 'steady') {
    if (stormy) return 'Holding low, storms persisting.';
    if (wet) return 'Steady — precipitation likely to continue.';
    return 'Steady — conditions stable for now.';
  }

  const fast = Math.abs(rate) >= STORM_THRESHOLD_PER_3H;

  if (direction === 'falling') {
    if (fast) return 'Falling fast — weather likely deteriorating.';
    return 'Falling — clouds and precipitation possible.';
  }
  // rising
  if (fast) return 'Rising fast — clearing on the way.';
  return 'Rising — conditions likely improving.';
}
