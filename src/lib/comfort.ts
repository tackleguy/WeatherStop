// Comfort indices: heat index, wind chill, and a unified "feels-like"
// commentary that explains *why* the apparent temperature differs from
// the air temperature. The UI uses this to show a one-liner under the
// Feels-Like cell — far more useful than just printing the diff.
//
// Inputs are canonical WeatherData units (°F + mph). Outputs are also
// °F. The display layer takes care of converting to Celsius.

export type ComfortKind =
  | 'heat'
  | 'wind-chill'
  | 'humid'
  | 'dry'
  | 'mild'
  | 'cold';

export interface ComfortReading {
  kind: ComfortKind;
  /** °F. Same value the app already shows; we recompute server-style for
   *  edge cases where Open-Meteo's apparent_temperature is missing or
   *  stale. */
  feelsLikeF: number;
  /** Difference vs actual, °F. Positive = warmer than air, negative = cooler. */
  diff: number;
  /** "Cold" / "Cool" / "Mild" / "Warm" / "Hot" / "Sweltering" / "Bitter cold". */
  label: string;
  /** One-sentence description of why feels-like differs. */
  reason: string;
}

// NOAA Rothfusz heat index (regression). Valid for T ≥ 80°F and RH ≥ 40%.
function heatIndexF(t: number, rh: number): number {
  const HI =
    -42.379 +
    2.04901523 * t +
    10.14333127 * rh -
    0.22475541 * t * rh -
    6.83783e-3 * t * t -
    5.481717e-2 * rh * rh +
    1.22874e-3 * t * t * rh +
    8.5282e-4 * t * rh * rh -
    1.99e-6 * t * t * rh * rh;

  let adjustment = 0;
  if (rh < 13 && t >= 80 && t <= 112) {
    adjustment = -((13 - rh) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
  } else if (rh > 85 && t >= 80 && t <= 87) {
    adjustment = ((rh - 85) / 10) * ((87 - t) / 5);
  }
  return HI + adjustment;
}

// NWS wind-chill (NOAA). Valid for T ≤ 50°F and wind ≥ 3 mph.
function windChillF(t: number, mph: number): number {
  return (
    35.74 +
    0.6215 * t -
    35.75 * Math.pow(mph, 0.16) +
    0.4275 * t * Math.pow(mph, 0.16)
  );
}

interface Inputs {
  tempF: number;
  rh: number; // 0-100
  windMph: number;
  apparentF: number;
}

export function comfortFor({
  tempF,
  rh,
  windMph,
  apparentF,
}: Inputs): ComfortReading {
  // Compute the canonical feels-like, then prefer the source-provided
  // apparent value when it falls within ±5°F of ours (sanity check).
  let computed = tempF;
  let kind: ComfortKind = 'mild';
  let reason = 'Feels close to the air temperature.';

  if (tempF >= 80 && rh >= 40) {
    computed = heatIndexF(tempF, rh);
    kind = rh >= 70 ? 'humid' : 'heat';
    reason =
      rh >= 70
        ? 'High humidity makes the air feel warmer than it is.'
        : 'Direct sun and warmth combine to push the feels-like up.';
  } else if (tempF <= 50 && windMph >= 3) {
    computed = windChillF(tempF, windMph);
    kind = 'wind-chill';
    reason = `Wind around ${Math.round(windMph)} mph drops the feels-like.`;
  } else if (tempF >= 80 && rh < 30) {
    computed = tempF - (30 - rh) * 0.1;
    kind = 'dry';
    reason = 'Very dry air feels slightly cooler than the thermometer.';
  } else if (tempF <= 35) {
    kind = 'cold';
    reason = 'Cold air with little wind — bundle up.';
  }

  // Prefer source-provided apparent if reasonable.
  const fromSource = Number.isFinite(apparentF) ? apparentF : computed;
  const useSource = Math.abs(fromSource - computed) <= 5 || computed === tempF;
  const feelsLikeF = useSource ? fromSource : computed;
  const diff = +(feelsLikeF - tempF).toFixed(0);

  return {
    kind,
    feelsLikeF,
    diff,
    label: bandLabel(feelsLikeF),
    reason,
  };
}

function bandLabel(f: number): string {
  if (f < 10) return 'Bitter cold';
  if (f < 32) return 'Cold';
  if (f < 50) return 'Chilly';
  if (f < 65) return 'Cool';
  if (f < 78) return 'Mild';
  if (f < 90) return 'Warm';
  if (f < 100) return 'Hot';
  return 'Sweltering';
}

// Dew-point comfort bands (used by HumidityCard's hint and the
// CompareModal). Source: standard meteorology comfort scale.
export function dewPointComfort(dewF: number): {
  label: string;
  tone: 'good' | 'okay' | 'sticky' | 'oppressive';
} {
  if (dewF < 50) return { label: 'Comfortable', tone: 'good' };
  if (dewF < 60) return { label: 'A little muggy', tone: 'okay' };
  if (dewF < 65) return { label: 'Sticky', tone: 'sticky' };
  if (dewF < 70) return { label: 'Uncomfortable', tone: 'sticky' };
  if (dewF < 75) return { label: 'Oppressive', tone: 'oppressive' };
  return { label: 'Tropical', tone: 'oppressive' };
}
