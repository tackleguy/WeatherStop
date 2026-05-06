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
