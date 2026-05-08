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

// Surface temperature palette (°F). Mirrors `tempColor` in api/weather/grid.ts.
export const TEMP_STOPS: ScalarStop[] = [
  { value: -20, color: '#8000c0' },
  { value: 0, color: '#3264dc' },
  { value: 32, color: '#64c8f0' },
  { value: 60, color: '#50c864' },
  { value: 80, color: '#ffdc3c' },
  { value: 100, color: '#f0503c' },
  { value: 120, color: '#f050c8' },
];
