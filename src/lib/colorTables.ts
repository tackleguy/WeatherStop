// Numeric color tables — palette values aren't copyrightable; the NWS
// reflectivity palette is widely published and used here for consistency
// with NOAA's own renderings.

export type Severity =
  | 'extreme'
  | 'severe'
  | 'moderate'
  | 'minor'
  | 'unknown';

export function severityColor(s: string): string {
  const map: Record<Severity, string> = {
    extreme: 'var(--sev-extreme)',
    severe: 'var(--sev-severe)',
    moderate: 'var(--sev-moderate)',
    minor: 'var(--sev-minor)',
    unknown: 'var(--sev-unknown)',
  };
  return map[(s as Severity) ?? 'unknown'] ?? map.unknown;
}

export function severityRank(s: string): number {
  return (
    ({ extreme: 4, severe: 3, moderate: 2, minor: 1 } as Record<
      string,
      number
    >)[s] ?? 0
  );
}

export interface DBZStop {
  dbz: number;
  color: string;
}

export const DBZ_STOPS: DBZStop[] = [
  { dbz: -30, color: '#00ECEC' },
  { dbz: -20, color: '#0000F6' },
  { dbz: -10, color: '#00FF00' },
  { dbz: 0, color: '#FFFF00' },
  { dbz: 10, color: '#FF9000' },
  { dbz: 20, color: '#FF0000' },
  { dbz: 30, color: '#FF00FF' },
  { dbz: 40, color: '#FFFFFF' },
];

export const KTS_STOPS: DBZStop[] = [
  { dbz: -64, color: '#00ECEC' },
  { dbz: -32, color: '#0000F6' },
  { dbz: -16, color: '#00FF00' },
  { dbz: 0, color: '#FFFFFF' },
  { dbz: 16, color: '#FFFF00' },
  { dbz: 32, color: '#FF9000' },
  { dbz: 64, color: '#FF0000' },
];

// Correlation Coefficient: low values flag debris / hail / non-met
// scatter; near-1.0 is uniform precipitation. Stops mirror the
// renderer's `ccColor` palette in api/radar/level2.ts.
export interface RhoStop {
  rho: number;
  color: string;
  label: string;
}
export const RHO_STOPS: RhoStop[] = [
  { rho: 0.5, color: '#b400c8', label: 'Debris' },
  { rho: 0.7, color: '#dc6400', label: 'Hail' },
  { rho: 0.85, color: '#dcdc00', label: 'Mixed' },
  { rho: 0.95, color: '#50c850', label: 'Rain' },
  { rho: 1.0, color: '#50c850', label: 'Pure rain' },
];

/** Azimuthal shear proxy (ΔV kts across adjacent radials). */
export interface ShearStop {
  value: number;
  color: string;
  label: string;
}
export const SHEAR_STOPS: ShearStop[] = [
  { value: -20, color: '#28b4ff', label: 'Anti' },
  { value: -8, color: '#50c8ff', label: '' },
  { value: 0, color: '#404040', label: '0' },
  { value: 8, color: '#ffdc00', label: '' },
  { value: 20, color: '#ff0050', label: 'Cyclonic' },
];

// Surface wind palette (mph). Mirrors `windColor` in api/weather/grid.ts.
export interface ScalarStop {
  value: number;
  color: string;
}
export const WIND_STOPS: ScalarStop[] = [
  { value: 0, color: '#3250c8' },
  { value: 20, color: '#50c864' },
  { value: 40, color: '#dcdc00' },
  { value: 60, color: '#ff0000' },
];

// Surface temperature palette (°F). Mirrors `tempColor` in api/weather/field.ts.
export const TEMP_STOPS: ScalarStop[] = [
  { value: -20, color: '#8000c0' },
  { value: 0, color: '#3264dc' },
  { value: 32, color: '#64c8f0' },
  { value: 60, color: '#50c864' },
  { value: 80, color: '#ffdc3c' },
  { value: 100, color: '#f0503c' },
  { value: 120, color: '#f050c8' },
];

/** Hourly rain forecast (in/h) — Open-Meteo precipitation. */
export const RAIN_FCST_STOPS: ScalarStop[] = [
  { value: 0.01, color: '#2864dc' },
  { value: 0.05, color: '#28c850' },
  { value: 0.15, color: '#e0dc28' },
  { value: 0.4, color: '#f05028' },
  { value: 1.0, color: '#c828c8' },
];

/** Echo tops (kft) — approximate MRMS style ramp. */
export const ECHO_STOPS: ScalarStop[] = [
  { value: 10, color: '#00a0ff' },
  { value: 20, color: '#00e080' },
  { value: 30, color: '#ffff00' },
  { value: 40, color: '#ff8000' },
  { value: 50, color: '#ff0000' },
  { value: 60, color: '#ff00ff' },
];

export interface LabeledStop {
  color: string;
  label: string;
}

export const PTYPE_STOPS: LabeledStop[] = [
  { color: '#00c800', label: 'Rain' },
  { color: '#00ffff', label: 'Freezing rain' },
  { color: '#ff80ff', label: 'Ice / mix' },
  { color: '#ffffff', label: 'Snow' },
];

export const RAIN_STOPS: ScalarStop[] = [
  { value: 0.1, color: '#a0f0a0' },
  { value: 0.5, color: '#00c800' },
  { value: 1, color: '#ffff00' },
  { value: 2, color: '#ff8000' },
  { value: 4, color: '#ff0000' },
];

export const HHC_STOPS: LabeledStop[] = [
  { color: '#808080', label: 'Other / clutter' },
  { color: '#00c800', label: 'Rain' },
  { color: '#ffff00', label: 'Big drops' },
  { color: '#ff8000', label: 'Hail' },
  { color: '#ffffff', label: 'Snow / ice' },
];
