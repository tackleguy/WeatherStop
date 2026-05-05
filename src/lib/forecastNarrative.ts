import { displayWindSpeed } from './display';
import { formatHourLabel } from './format';
import { mphToKmh } from './units';
import type { Settings, WeatherData } from '../types';

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
  data: WeatherData,
  settings: Settings,
): string {
  const hourly = data.hourly.slice(0, 12);
  if (hourly.length < 4) return '';
  const nowCode = hourly[0].code;

  let changeIdx = -1;
  for (let i = 1; i < hourly.length; i++) {
    if (Math.abs(hourly[i].code - nowCode) >= 2) {
      changeIdx = i;
      break;
    }
  }

  let primary: string;
  if (changeIdx > 0) {
    primary = `${conditionPhrase(hourly[changeIdx].code)} expected around ${formatHourLabel(
      hourly[changeIdx].time,
      data.location.timezone,
    )}.`;
  } else {
    primary = `${conditionPhrase(nowCode)} for the next several hours.`;
  }

  // windGust is canonical mph in WeatherData; threshold is 15 mph.
  const gustMph = data.current.windGust;
  void mphToKmh; // imported for future use
  const gustNote =
    gustMph > 15
      ? ` Wind gusts up to ${displayWindSpeed(gustMph, settings)}.`
      : '';

  return primary + gustNote;
}
