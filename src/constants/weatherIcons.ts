// WMO weather_code → emoji, with separate day/night tables.

const day: Record<number, string> = {
  0: '☀️',
  1: '🌤',
  2: '⛅',
  3: '☁️',
  45: '🌫',
  48: '🌫',
  51: '🌦',
  53: '🌦',
  55: '🌦',
  61: '🌧',
  63: '🌧',
  65: '🌧',
  71: '❄️',
  73: '❄️',
  75: '❄️',
  77: '❄️',
  80: '🌧',
  81: '🌧',
  82: '🌧',
  85: '🌨',
  86: '🌨',
  95: '⛈',
  96: '⛈',
  99: '⛈',
};

const night: Record<number, string> = {
  0: '🌙',
  1: '🌙',
  2: '☁️',
  3: '☁️',
  45: '🌫',
  48: '🌫',
  51: '🌧',
  53: '🌧',
  55: '🌧',
  61: '🌧',
  63: '🌧',
  65: '🌧',
  71: '❄️',
  73: '❄️',
  75: '❄️',
  77: '❄️',
  80: '🌧',
  81: '🌧',
  82: '🌧',
  85: '🌨',
  86: '🌨',
  95: '⛈',
  96: '⛈',
  99: '⛈',
};

export function iconFor(code: number, isDay: number | boolean = 1): string {
  const isDaytime = typeof isDay === 'boolean' ? isDay : isDay !== 0;
  return (isDaytime ? day : night)[code] ?? '❓';
}
