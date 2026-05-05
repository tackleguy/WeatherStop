import { formatHourLabel, formatWindSpeed } from './format';
import type { ForecastResponse, Settings } from '../types';

function conditionPhrase(code: number): string {
  if (code === 0) return 'Clear conditions';
  if (code === 1 || code === 2) return 'Partly cloudy conditions';
  if (code === 3) return 'Overcast conditions';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Snow';
  if (code >= 95) return 'Thunderstorms';
  return 'Mixed conditions';
}

export function describeNext24h(
  data: ForecastResponse,
  settings: Settings,
): string {
  const hourly = data.hourly;
  const now = new Date(data.current.time).getTime();

  // Slice future hours so the change-detection runs on what's coming.
  const future: { time: string; code: number; gust: number }[] = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i]).getTime();
    if (t < now - 60 * 60_000) continue;
    future.push({
      time: hourly.time[i],
      code: hourly.weather_code[i],
      gust: data.current.wind_gusts_10m,
    });
    if (future.length >= 12) break;
  }

  if (future.length < 4) return '';
  const nowCode = future[0].code;

  let changeIdx = -1;
  for (let i = 1; i < future.length; i++) {
    if (Math.abs(future[i].code - nowCode) >= 2) {
      changeIdx = i;
      break;
    }
  }

  let primary: string;
  if (changeIdx > 0) {
    primary = `${conditionPhrase(future[changeIdx].code)} expected around ${formatHourLabel(
      future[changeIdx].time,
      data.timezone,
    )}.`;
  } else {
    primary = `${conditionPhrase(nowCode)} for the next several hours.`;
  }

  // Gust threshold is in mph regardless of display unit.
  const gustValue = data.current.wind_gusts_10m;
  const gustMph =
    settings.wind === 'kmh' ? gustValue * 0.621371 : gustValue;
  const gustNote =
    gustMph > 15
      ? ` Wind gusts up to ${formatWindSpeed(gustValue, settings.wind)}.`
      : '';

  return primary + gustNote;
}
