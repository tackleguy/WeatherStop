// WMO Weather interpretation codes (https://open-meteo.com/en/docs)

export interface WeatherCodeInfo {
  label: string;
  emoji: string;
  group: WeatherGroup;
}

export type WeatherGroup =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'showers'
  | 'thunderstorm';

const TABLE: Record<number, WeatherCodeInfo> = {
  0: { label: 'Clear', emoji: '☀️', group: 'clear' },
  1: { label: 'Mostly Clear', emoji: '🌤', group: 'partly_cloudy' },
  2: { label: 'Partly Cloudy', emoji: '🌤', group: 'partly_cloudy' },
  3: { label: 'Cloudy', emoji: '☁️', group: 'cloudy' },
  45: { label: 'Fog', emoji: '🌫', group: 'fog' },
  48: { label: 'Freezing Fog', emoji: '🌫', group: 'fog' },
  51: { label: 'Light Drizzle', emoji: '🌦', group: 'drizzle' },
  53: { label: 'Drizzle', emoji: '🌦', group: 'drizzle' },
  55: { label: 'Heavy Drizzle', emoji: '🌦', group: 'drizzle' },
  56: { label: 'Freezing Drizzle', emoji: '🌧', group: 'drizzle' },
  57: { label: 'Heavy Freezing Drizzle', emoji: '🌧', group: 'drizzle' },
  61: { label: 'Light Rain', emoji: '🌧', group: 'rain' },
  63: { label: 'Rain', emoji: '🌧', group: 'rain' },
  65: { label: 'Heavy Rain', emoji: '🌧', group: 'rain' },
  66: { label: 'Freezing Rain', emoji: '🌧', group: 'rain' },
  67: { label: 'Heavy Freezing Rain', emoji: '🌧', group: 'rain' },
  71: { label: 'Light Snow', emoji: '❄️', group: 'snow' },
  73: { label: 'Snow', emoji: '❄️', group: 'snow' },
  75: { label: 'Heavy Snow', emoji: '❄️', group: 'snow' },
  77: { label: 'Snow Grains', emoji: '❄️', group: 'snow' },
  80: { label: 'Light Showers', emoji: '🌧', group: 'showers' },
  81: { label: 'Showers', emoji: '🌧', group: 'showers' },
  82: { label: 'Heavy Showers', emoji: '🌧', group: 'showers' },
  85: { label: 'Snow Showers', emoji: '🌨', group: 'snow' },
  86: { label: 'Heavy Snow Showers', emoji: '🌨', group: 'snow' },
  95: { label: 'Thunderstorm', emoji: '⛈', group: 'thunderstorm' },
  96: { label: 'Thunderstorm w/ Hail', emoji: '⛈', group: 'thunderstorm' },
  99: { label: 'Severe Thunderstorm', emoji: '⛈', group: 'thunderstorm' },
};

export function describe(code: number): WeatherCodeInfo {
  return TABLE[code] ?? { label: 'Unknown', emoji: '🌡', group: 'cloudy' };
}

export type GradientName =
  | 'clear-day'
  | 'clear-night'
  | 'cloudy-day'
  | 'cloudy-night'
  | 'rain'
  | 'snow'
  | 'thunderstorm'
  | 'fog'
  | 'sunset'
  | 'sunrise';

export function gradientFor(
  code: number,
  isDay: boolean,
  localHour: number,
): GradientName {
  const info = describe(code);

  if (info.group === 'thunderstorm') return 'thunderstorm';
  if (info.group === 'snow') return 'snow';
  if (info.group === 'rain' || info.group === 'showers' || info.group === 'drizzle')
    return 'rain';
  if (info.group === 'fog') return 'fog';

  const isClearish =
    info.group === 'clear' || info.group === 'partly_cloudy';

  if (isDay && isClearish) {
    if (localHour >= 5 && localHour <= 7) return 'sunrise';
    if (localHour >= 17 && localHour <= 19) return 'sunset';
    return 'clear-day';
  }
  if (!isDay && isClearish) return 'clear-night';

  return isDay ? 'cloudy-day' : 'cloudy-night';
}
