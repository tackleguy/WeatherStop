import type { WeatherData } from '../types';

function getLocalHour(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: tz,
  }).formatToParts(new Date(iso));
  const h = parts.find((p) => p.type === 'hour')?.value ?? '0';
  return parseInt(h, 10);
}

export function validateWeatherData(d: WeatherData): void {
  const errors: string[] = [];

  // Current temperature
  if (!Number.isFinite(d.current.temp)) errors.push('current.temp not finite');
  if (d.current.temp < -100 || d.current.temp > 150)
    errors.push(`current.temp out of range: ${d.current.temp}`);

  // Today's high/low
  if (!Number.isFinite(d.today.high) || !Number.isFinite(d.today.low))
    errors.push('today H/L not finite');
  if (d.today.high < d.today.low)
    errors.push(`today H<L impossible: ${d.today.high}/${d.today.low}`);
  if (d.today.high === d.today.low)
    errors.push(`today H===L impossible: ${d.today.high}`);

  // Humidity
  if (d.current.humidity < 1 || d.current.humidity > 100)
    errors.push(`humidity out of range: ${d.current.humidity}`);

  // Wind: gust must be >= speed
  if (d.current.windGust < d.current.windSpeed)
    errors.push(
      `gust<speed: ${d.current.windGust}<${d.current.windSpeed}`,
    );

  // Sunrise / sunset
  const sunrise = new Date(d.today.sunrise);
  const sunset = new Date(d.today.sunset);
  if (Number.isNaN(sunrise.getTime())) errors.push('sunrise unparseable');
  if (Number.isNaN(sunset.getTime())) errors.push('sunset unparseable');
  if (sunset <= sunrise) errors.push('sunset before sunrise');

  if (!Number.isNaN(sunrise.getTime())) {
    const sh = getLocalHour(d.today.sunrise, d.location.timezone);
    if (sh < 3 || sh > 10)
      errors.push(`sunrise at impossible hour: ${sh}`);
  }
  if (!Number.isNaN(sunset.getTime())) {
    const sh = getLocalHour(d.today.sunset, d.location.timezone);
    if (sh < 15 || sh > 22) errors.push(`sunset at impossible hour: ${sh}`);
  }

  // Daily array
  if (d.daily.length < 7)
    errors.push(`daily forecast too short: ${d.daily.length}`);
  for (const day of d.daily) {
    if (day.high < day.low) errors.push(`daily H<L on ${day.date}`);
    if (day.high === day.low)
      errors.push(`daily H===L on ${day.date}: ${day.high}`);
  }

  if (errors.length) {
    console.error('[validate] WeatherData failed validation:', errors, d);
    throw new Error(`WeatherData invalid: ${errors.join('; ')}`);
  }
}
