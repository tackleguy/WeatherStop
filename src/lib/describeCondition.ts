import type { Settings } from '../types';

function tempInF(value: number, unit: Settings['temp']): number {
  return unit === 'celsius' ? (value * 9) / 5 + 32 : value;
}

export function describeCondition(
  temp: number,
  unit: Settings['temp'],
  code: number,
): string {
  const f = tempInF(temp, unit);
  const t =
    f < 40 ? 'Cold' : f < 55 ? 'Cool' : f < 75 ? 'Mild' : f < 88 ? 'Warm' : 'Hot';

  if (code === 0) return `${t} and clear`;
  if (code === 1) return `${t} and mostly clear`;
  if (code === 2) return `${t}, partly cloudy`;
  if (code === 3) return `${t} and cloudy`;
  if (code === 45 || code === 48) return `${t} and foggy`;
  if (code >= 51 && code <= 67) return `${t} and rainy`;
  if ((code >= 80 && code <= 82)) return `${t} with showers`;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return `${t} and snowy`;
  if (code >= 95) return 'Stormy';
  return t;
}
