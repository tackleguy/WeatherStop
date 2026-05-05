export type TempUnit = 'fahrenheit' | 'celsius';
export type WindUnit = 'mph' | 'kmh';
export type DistanceUnit = 'mi' | 'km';
export type PrecipUnit = 'inch' | 'mm';

export interface Settings {
  temp: TempUnit;
  wind: WindUnit;
  distance: DistanceUnit;
  precip: PrecipUnit;
}

export interface City {
  id: string;
  name: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  isCurrent?: boolean;
}

export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  timezone?: string;
}

export interface CurrentWeather {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  is_day: 0 | 1;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
  pressure_msl: number;
  cloud_cover: number;
  visibility: number;
  uv_index: number;
}

export interface HourlyData {
  time: string[];
  temperature_2m: number[];
  weather_code: number[];
  precipitation_probability: number[];
  precipitation: number[];
  is_day: number[];
}

export interface DailyData {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  sunrise: string[];
  sunset: string[];
  uv_index_max: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  wind_direction_10m_dominant: number[];
}

export interface ForecastResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  timezone_abbreviation: string;
  utc_offset_seconds: number;
  current: CurrentWeather;
  current_units: Record<string, string>;
  hourly: HourlyData;
  hourly_units: Record<string, string>;
  daily: DailyData;
  daily_units: Record<string, string>;
}

export interface AirQualityResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    us_aqi: number;
    pm2_5: number;
    pm10: number;
    carbon_monoxide: number;
    nitrogen_dioxide: number;
    ozone: number;
  };
  current_units: Record<string, string>;
}

export interface WeatherBundle {
  forecast: ForecastResponse;
  airQuality?: AirQualityResponse;
  alerts?: WeatherAlert[];
  source: 'nws' | 'open-meteo';
  fetchedAt: number;
}

export interface WeatherAlert {
  id: string;
  event: string;
  severity: string;
  headline: string;
  description: string;
  areaDesc: string;
  effective: string;
  expires: string;
}
