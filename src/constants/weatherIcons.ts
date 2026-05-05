// Mapping helpers — used when we want to render emoji icons for forecasts.
import { describe } from '../lib/weatherCodes';

export function iconFor(code: number, isDay = 1): string {
  const info = describe(code);
  if (!isDay && info.group === 'clear') return '🌙';
  if (!isDay && info.group === 'partly_cloudy') return '☁️';
  return info.emoji;
}
