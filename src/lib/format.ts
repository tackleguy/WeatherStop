// Time + label formatting helpers. Unit-aware temperature / wind / pressure
// formatting lives in display.ts so the canonical-units pipeline is
// preserved.

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
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return dirs[idx];
}

export function formatTime(iso: string, timezone?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

export function formatHourLabel(iso: string, timezone?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      timeZone: timezone,
    })
    .replace(' ', '');
}

export function formatDayLabel(iso: string, timezone?: string): string {
  if (!iso) return '';
  const source =
    iso.length === 10 ? `${iso}T12:00:00Z` : iso;
  const d = new Date(source);
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
