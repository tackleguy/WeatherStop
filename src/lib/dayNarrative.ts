// Builds a short natural-language summary for each day in the 10-day
// forecast. Used inline under the day name in DailyForecast — adds
// context that bare H/L numbers don't convey ("rain ending overnight",
// "windy and cool", "sunny and warm").

import type { Settings, WeatherData } from '../types';
import { displayTemp } from './display';

export interface DayNarrative {
  /** Single short sentence under the day name. */
  short: string;
  /** Optional secondary clause shown only on hover / detail. */
  detail?: string;
}

interface NarrativeContext {
  prevCode?: number;
  nextCode?: number;
}

// Map a WMO weather code to the prevalent precipitation type, if any.
// Used both for the narrative and for the "rain ending overnight" cue.
function precipKind(code: number): 'rain' | 'snow' | 'thunder' | 'fog' | null {
  if (code >= 95) return 'thunder';
  if (code >= 71 && code <= 77) return 'snow';
  if (code === 85 || code === 86) return 'snow';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 80 && code <= 82) return 'rain';
  return null;
}

function clearishLabel(code: number): string {
  if (code === 0) return 'sunny';
  if (code === 1) return 'mostly sunny';
  if (code === 2) return 'partly cloudy';
  return 'cloudy';
}

function tempBand(highF: number, _lowF: number): string {
  // Mid-day high drives the "warmth" word; the spread drives "warm and
  // cool by night" type modifiers we add later.
  if (highF >= 95) return 'sweltering';
  if (highF >= 88) return 'hot';
  if (highF >= 78) return 'warm';
  if (highF >= 65) return 'mild';
  if (highF >= 50) return 'cool';
  if (highF >= 35) return 'cold';
  return 'frigid';
}

// Public: per-day narrative. Index is the position in WeatherData.daily
// (0 = today). The neighbours give us the prev/next code which lets us
// say things like "rain ending overnight" or "showers continuing."
export function narrativeFor(
  data: WeatherData,
  index: number,
  settings: Settings,
): DayNarrative {
  const day = data.daily[index];
  if (!day) return { short: '' };
  const ctx: NarrativeContext = {
    prevCode: data.daily[index - 1]?.code,
    nextCode: data.daily[index + 1]?.code,
  };

  const kind = precipKind(day.code);
  const warmth = tempBand(day.high, day.low);
  const range = day.high - day.low;

  // Wind hint: pull from current wind only if today (we don't have
  // per-day wind). For other days, use the precip prob to flavour.
  let primary: string;

  if (kind === 'thunder') {
    primary = `${cap(warmth)} with thunderstorms, ${pop(day.precipProbMax)}.`;
  } else if (kind === 'rain') {
    if (ctx.prevCode && precipKind(ctx.prevCode) === 'rain') {
      primary = `${cap(warmth)}, rain continuing — ${pop(day.precipProbMax)}.`;
    } else if (ctx.nextCode && precipKind(ctx.nextCode) === null) {
      primary = `${cap(warmth)}, rain ending overnight.`;
    } else {
      primary = `${cap(warmth)}, ${pop(day.precipProbMax)} of rain.`;
    }
  } else if (kind === 'snow') {
    primary = `${cap(warmth)} with snow, ${pop(day.precipProbMax)}.`;
  } else if (kind === 'fog') {
    primary = `${cap(warmth)}, areas of fog.`;
  } else {
    // Clear/cloudy. Add a swing comment when the high/low spread is wide.
    const sky = clearishLabel(day.code);
    if (range >= 30) {
      primary = `${cap(warmth)} and ${sky}; cool overnight (${displayTemp(day.low, settings)}).`;
    } else {
      primary = `${cap(warmth)} and ${sky}.`;
    }
  }

  const detail = buildDetail(day, kind, ctx);
  return { short: primary, detail };
}

function buildDetail(
  day: WeatherData['daily'][number],
  kind: ReturnType<typeof precipKind>,
  ctx: NarrativeContext,
): string | undefined {
  const parts: string[] = [];
  if (kind && day.precipProbMax >= 70) {
    parts.push('Plan around precipitation.');
  }
  if (ctx.prevCode != null && precipKind(ctx.prevCode) && !kind) {
    parts.push('Clearing through the day.');
  }
  if (ctx.nextCode != null && precipKind(ctx.nextCode) && !kind) {
    parts.push('Watch for changes overnight.');
  }
  if (parts.length === 0) return undefined;
  return parts.join(' ');
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pop(prob: number): string {
  if (prob >= 80) return 'highly likely';
  if (prob >= 60) return 'likely';
  if (prob >= 40) return 'possible';
  if (prob >= 20) return 'a chance';
  return 'unlikely';
}

// Weekly headline — used at the top of DailyForecast as a one-liner.
export function weekHeadline(data: WeatherData): string {
  const days = data.daily.slice(0, 7);
  if (days.length === 0) return '';
  const wettest = days.reduce(
    (m, d) => (d.precipProbMax > m.precipProbMax ? d : m),
    days[0],
  );
  const warmest = days.reduce((m, d) => (d.high > m.high ? d : m), days[0]);
  const coolest = days.reduce((m, d) => (d.low < m.low ? d : m), days[0]);

  const wettestDay = labelDay(wettest.date, data.location.timezone);
  const warmestDay = labelDay(warmest.date, data.location.timezone);
  const coolestDay = labelDay(coolest.date, data.location.timezone);

  if (wettest.precipProbMax >= 60) {
    return `Wettest ${wettestDay} (${wettest.precipProbMax}%); warmest ${warmestDay}.`;
  }
  return `Warmest ${warmestDay}, coolest ${coolestDay}. Quiet week.`;
}

function labelDay(date: string, tz: string): string {
  const source = date.length === 10 ? `${date}T12:00:00Z` : date;
  return new Date(source).toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: tz,
  });
}
