// Display layer — converts canonical WeatherData fields (°F / mph / inHg /
// miles) into the user's preferred units. Components never read raw units
// directly; they always go through here.

import {
  fToC,
  hpaToInHg,
  inHgToHpa,
  inchToMm,
  milesToKm,
  mphToKmh,
} from './units';
import type { Settings } from '../types';

export function displayTemp(
  f: number,
  settings: Settings,
  opts: { withDegree?: boolean } = {},
): string {
  const v = settings.temp === 'celsius' ? fToC(f) : f;
  const r = Math.round(v);
  return opts.withDegree === false ? `${r}` : `${r}°`;
}

export function displayTempUnit(unit: Settings['temp']): string {
  return unit === 'celsius' ? '°C' : '°F';
}

export function displayWindSpeed(
  mph: number,
  settings: Settings,
): string {
  if (settings.wind === 'kmh') return `${Math.round(mphToKmh(mph))} km/h`;
  return `${Math.round(mph)} mph`;
}

export function displayPressure(inHg: number): string {
  // Always show hPa for readability (most countries use it; °F users still
  // tolerate it). If we ever want inHg as an option we can add it here.
  const hpa = inHgToHpa(inHg);
  // Defensive: inHgToHpa is the inverse of hpaToInHg(...) → identity.
  // Keep call chain explicit so callers can't accidentally pass hPa.
  void hpaToInHg;
  return `${Math.round(hpa)} hPa`;
}

// Visibility is capped at 10 miles / 16 km. Apple Weather treats that as
// "as far as the eye can see"; raw values can exceed 70 miles in clear,
// dry desert air, which is misleading on a 0-10 visibility report card.
export function displayVisibility(
  miles: number,
  settings: Settings,
): string {
  const capped = Math.min(Math.max(miles, 0), 10);
  if (settings.distance === 'mi') {
    return capped >= 10 ? '10 mi' : `${capped.toFixed(1)} mi`;
  }
  const km = milesToKm(capped);
  return km >= 16 ? '16 km' : `${km.toFixed(1)} km`;
}

export function displayPrecip(
  inches: number,
  settings: Settings,
): string {
  if (settings.precip === 'inch') return `${inches.toFixed(2)} in`;
  return `${inchToMm(inches).toFixed(1)} mm`;
}
