import type { Settings } from '../types';

// All values that come back from the API are already in the requested unit
// thanks to the query params, so formatting is mostly cosmetic.

export function formatTemp(value: number, opts: { withDegree?: boolean } = {}): string {
  const rounded = Math.round(value);
  return opts.withDegree === false ? `${rounded}` : `${rounded}°`;
}

export function formatTempUnit(unit: Settings['temp']): string {
  return unit === 'fahrenheit' ? '°F' : '°C';
}

export function formatWindSpeed(value: number, unit: Settings['wind']): string {
  return `${Math.round(value)} ${unit === 'mph' ? 'mph' : 'km/h'}`;
}

export function formatPrecip(value: number, unit: Settings['precip']): string {
  if (unit === 'inch') return `${value.toFixed(2)} in`;
  return `${value.toFixed(1)} mm`;
}

export function formatVisibility(meters: number, unit: Settings['distance']): string {
  if (unit === 'mi') {
    const miles = meters / 1609.344;
    return `${miles >= 10 ? Math.round(miles) : miles.toFixed(1)} mi`;
  }
  const km = meters / 1000;
  return `${km >= 10 ? Math.round(km) : km.toFixed(1)} km`;
}

export function formatPressure(hpa: number): string {
  return `${Math.round(hpa)} hPa`;
}

export function formatWindDir(deg: number): string {
  const dirs = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const idx = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[idx];
}

export function formatTime(iso: string, timezone?: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

export function formatHourLabel(iso: string, timezone?: string): string {
  const d = new Date(iso);
  return d
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      timeZone: timezone,
    })
    .replace(' ', '');
}

export function formatDayLabel(iso: string, timezone?: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: timezone,
  });
}

export function relativeTimeShort(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function durationBetween(aIso: string, bIso: string): string {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  const ms = Math.max(0, b - a);
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

// Get the local hour at a given timezone for a given Date.
export function localHourIn(timezone: string | undefined, date = new Date()): number {
  if (!timezone) return date.getHours();
  const formatted = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone,
  }).format(date);
  const parsed = parseInt(formatted, 10);
  return Number.isFinite(parsed) ? parsed % 24 : date.getHours();
}
