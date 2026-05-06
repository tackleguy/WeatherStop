// Beaufort scale + wind direction commentary. The scale's force numbers
// are far more meaningful to a weather-savvy user than raw mph values
// for context like "is it dangerous to bike" or "should I tie things
// down on the patio."
//
// We expose three pieces:
//   • beaufortFor(mph)            — { force, label, description }
//   • windCommentary(mph, dir)    — full sentence for the WindCard
//   • compassPoint(deg)           — 16-point name (already in lib/format,
//     re-exported here so the wind module is self-contained)
import { formatWindDir } from './format';

export interface BeaufortReading {
  force: number; // 0-12
  label: string; // 'Calm', 'Light air', …
  description: string; // descriptive text
}

const TABLE: Array<Omit<BeaufortReading, ''> & { upperMph: number }> = [
  { force: 0, upperMph: 1, label: 'Calm', description: 'Smoke rises straight up.' },
  { force: 1, upperMph: 3, label: 'Light air', description: 'Smoke drifts; leaves still.' },
  { force: 2, upperMph: 7, label: 'Light breeze', description: 'Leaves rustle; wind on face.' },
  { force: 3, upperMph: 12, label: 'Gentle breeze', description: 'Twigs and leaves in motion.' },
  { force: 4, upperMph: 18, label: 'Moderate breeze', description: 'Small branches move; dust stirs.' },
  { force: 5, upperMph: 24, label: 'Fresh breeze', description: 'Small trees sway; whitecaps form.' },
  { force: 6, upperMph: 31, label: 'Strong breeze', description: 'Large branches move; umbrellas hard to use.' },
  { force: 7, upperMph: 38, label: 'Near gale', description: 'Whole trees in motion; walking is harder.' },
  { force: 8, upperMph: 46, label: 'Gale', description: 'Twigs break off; cars veer.' },
  { force: 9, upperMph: 54, label: 'Strong gale', description: 'Slight structural damage; chimney pots loosen.' },
  { force: 10, upperMph: 63, label: 'Storm', description: 'Trees uprooted; significant damage likely.' },
  { force: 11, upperMph: 72, label: 'Violent storm', description: 'Widespread damage.' },
  { force: 12, upperMph: Infinity, label: 'Hurricane force', description: 'Devastation; shelter immediately.' },
];

export function beaufortFor(mph: number): BeaufortReading {
  for (const row of TABLE) {
    if (mph <= row.upperMph) {
      return {
        force: row.force,
        label: row.label,
        description: row.description,
      };
    }
  }
  return TABLE[TABLE.length - 1];
}

export function windCommentary(mph: number, dirDeg: number, gustMph?: number): string {
  const b = beaufortFor(mph);
  const compass = formatWindDir(dirDeg);
  const gustLine =
    gustMph !== undefined && gustMph >= mph + 5
      ? ` Gusts to ${Math.round(gustMph)} mph.`
      : '';
  return `${b.label} from the ${compass} (${b.description.toLowerCase()})${gustLine}`;
}

// Useful constant for callers that want to render the Beaufort number
// as a styled chip without re-deriving it.
export function beaufortBadgeColor(force: number): string {
  if (force <= 2) return 'rgba(148,163,184,0.85)'; // slate
  if (force <= 4) return 'rgba(56,189,248,0.85)'; // sky
  if (force <= 6) return 'rgba(34,197,94,0.85)'; // emerald
  if (force <= 8) return 'rgba(234,179,8,0.85)'; // yellow
  if (force <= 10) return 'rgba(249,115,22,0.85)'; // orange
  return 'rgba(239,68,68,0.9)'; // red
}
