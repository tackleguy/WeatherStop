// Open-Meteo weather models available via the forecast API `models=` param.
// Regional models may return "no data" outside their domain — the UI handles that.

export type ModelId = string;

export type ModelGroup =
  | 'noaa'
  | 'ecmwf'
  | 'dwd'
  | 'canada'
  | 'france'
  | 'uk'
  | 'japan'
  | 'korea'
  | 'china'
  | 'australia'
  | 'nordic'
  | 'netherlands'
  | 'denmark'
  | 'switzerland'
  | 'italy';

export interface WeatherModel {
  id: ModelId;
  label: string;
  short: string;
  group: ModelGroup;
  region: string;
  resolution: string;
  horizon: string;
  /** Prefer for default selection / CONUS users. */
  defaultSelected?: boolean;
}

export const MODEL_GROUP_LABELS: Record<ModelGroup, string> = {
  noaa: 'NOAA / NCEP',
  ecmwf: 'ECMWF',
  dwd: 'DWD ICON',
  canada: 'Environment Canada',
  france: 'Météo-France',
  uk: 'UK Met Office',
  japan: 'JMA',
  korea: 'KMA',
  china: 'CMA',
  australia: 'BOM',
  nordic: 'MET Norway',
  netherlands: 'KNMI',
  denmark: 'DMI',
  switzerland: 'MeteoSwiss',
  italy: 'ItaliaMeteo',
};

export const WEATHER_MODELS: WeatherModel[] = [
  // NOAA
  {
    id: 'gfs_seamless',
    label: 'GFS Seamless',
    short: 'GFS',
    group: 'noaa',
    region: 'Global',
    resolution: '3–25 km',
    horizon: '16d',
    defaultSelected: true,
  },
  {
    id: 'gfs_global',
    label: 'GFS Global',
    short: 'GFS·G',
    group: 'noaa',
    region: 'Global',
    resolution: '25 km',
    horizon: '16d',
  },
  {
    id: 'gfs_hrrr',
    label: 'HRRR',
    short: 'HRRR',
    group: 'noaa',
    region: 'CONUS',
    resolution: '3 km',
    horizon: '18–48h',
    defaultSelected: true,
  },
  {
    id: 'gfs_graphcast025',
    label: 'GraphCast GFS',
    short: 'GCast',
    group: 'noaa',
    region: 'Global',
    resolution: '25 km',
    horizon: '10d',
  },
  // ECMWF
  {
    id: 'ecmwf_ifs025',
    label: 'ECMWF IFS 0.25°',
    short: 'IFS',
    group: 'ecmwf',
    region: 'Global',
    resolution: '25 km',
    horizon: '15d',
    defaultSelected: true,
  },
  {
    id: 'ecmwf_ifs',
    label: 'ECMWF IFS',
    short: 'IFS·N',
    group: 'ecmwf',
    region: 'Global',
    resolution: '9 km',
    horizon: '10d',
  },
  {
    id: 'ecmwf_aifs025_single',
    label: 'ECMWF AIFS',
    short: 'AIFS',
    group: 'ecmwf',
    region: 'Global',
    resolution: '25 km',
    horizon: '15d',
  },
  // DWD
  {
    id: 'icon_seamless',
    label: 'ICON Seamless',
    short: 'ICON',
    group: 'dwd',
    region: 'Global',
    resolution: '2–13 km',
    horizon: '7.5d',
    defaultSelected: true,
  },
  {
    id: 'icon_global',
    label: 'ICON Global',
    short: 'ICON·G',
    group: 'dwd',
    region: 'Global',
    resolution: '13 km',
    horizon: '7.5d',
  },
  {
    id: 'icon_eu',
    label: 'ICON-EU',
    short: 'ICON·EU',
    group: 'dwd',
    region: 'Europe',
    resolution: '7 km',
    horizon: '5d',
  },
  {
    id: 'icon_d2',
    label: 'ICON-D2',
    short: 'ICON·D2',
    group: 'dwd',
    region: 'Germany',
    resolution: '2 km',
    horizon: '2d',
  },
  // Canada
  {
    id: 'gem_seamless',
    label: 'GEM Seamless',
    short: 'GEM',
    group: 'canada',
    region: 'Global / N. America',
    resolution: '2.5–25 km',
    horizon: '10d',
  },
  {
    id: 'gem_global',
    label: 'GEM Global',
    short: 'GEM·G',
    group: 'canada',
    region: 'Global',
    resolution: '25 km',
    horizon: '10d',
  },
  {
    id: 'gem_regional',
    label: 'GEM Regional',
    short: 'GEM·R',
    group: 'canada',
    region: 'N. America',
    resolution: '10 km',
    horizon: '3.5d',
  },
  {
    id: 'gem_hrdps_continental',
    label: 'HRDPS',
    short: 'HRDPS',
    group: 'canada',
    region: 'Canada',
    resolution: '2.5 km',
    horizon: '2d',
  },
  // France
  {
    id: 'meteofrance_seamless',
    label: 'Météo-France Seamless',
    short: 'MF',
    group: 'france',
    region: 'Global / Europe',
    resolution: '1–25 km',
    horizon: '4d',
  },
  {
    id: 'meteofrance_arpege_world',
    label: 'ARPEGE World',
    short: 'ARPEGE',
    group: 'france',
    region: 'Global',
    resolution: '25 km',
    horizon: '4d',
  },
  {
    id: 'meteofrance_arpege_europe',
    label: 'ARPEGE Europe',
    short: 'ARP·EU',
    group: 'france',
    region: 'Europe',
    resolution: '11 km',
    horizon: '4d',
  },
  {
    id: 'meteofrance_arome_france',
    label: 'AROME France',
    short: 'AROME',
    group: 'france',
    region: 'France',
    resolution: '1.3 km',
    horizon: '2d',
  },
  {
    id: 'meteofrance_arome_france_hd',
    label: 'AROME France HD',
    short: 'AROME·HD',
    group: 'france',
    region: 'France',
    resolution: '1.3 km',
    horizon: '2d',
  },
  // UK
  {
    id: 'ukmo_seamless',
    label: 'UKMO Seamless',
    short: 'UKMO',
    group: 'uk',
    region: 'Global / UK',
    resolution: '2–10 km',
    horizon: '7d',
  },
  {
    id: 'ukmo_global_deterministic_10km',
    label: 'UKMO Global 10km',
    short: 'UKMO·G',
    group: 'uk',
    region: 'Global',
    resolution: '10 km',
    horizon: '7d',
  },
  {
    id: 'ukmo_uk_deterministic_2km',
    label: 'UKMO UK 2km',
    short: 'UKMO·UK',
    group: 'uk',
    region: 'UK',
    resolution: '2 km',
    horizon: '2d',
  },
  // Japan
  {
    id: 'jma_seamless',
    label: 'JMA Seamless',
    short: 'JMA',
    group: 'japan',
    region: 'Global / Japan',
    resolution: '5–55 km',
    horizon: '11d',
  },
  {
    id: 'jma_gsm',
    label: 'JMA GSM',
    short: 'GSM',
    group: 'japan',
    region: 'Global',
    resolution: '55 km',
    horizon: '11d',
  },
  {
    id: 'jma_msm',
    label: 'JMA MSM',
    short: 'MSM',
    group: 'japan',
    region: 'Japan',
    resolution: '5 km',
    horizon: '4d',
  },
  // Korea
  {
    id: 'kma_seamless',
    label: 'KMA Seamless',
    short: 'KMA',
    group: 'korea',
    region: 'Global / Korea',
    resolution: '1.5–13 km',
    horizon: '12d',
  },
  {
    id: 'kma_gdps',
    label: 'KMA GDPS',
    short: 'GDPS',
    group: 'korea',
    region: 'Global',
    resolution: '12 km',
    horizon: '12d',
  },
  {
    id: 'kma_ldps',
    label: 'KMA LDPS',
    short: 'LDPS',
    group: 'korea',
    region: 'Korea',
    resolution: '1.5 km',
    horizon: '3d',
  },
  // China / Australia
  {
    id: 'cma_grapes_global',
    label: 'CMA GRAPES',
    short: 'GRAPES',
    group: 'china',
    region: 'Global',
    resolution: '15 km',
    horizon: '10d',
  },
  {
    id: 'bom_access_global',
    label: 'BOM ACCESS-G',
    short: 'ACCESS',
    group: 'australia',
    region: 'Global',
    resolution: '40 km',
    horizon: '10d',
  },
  // Nordic / NL / DK / CH / IT
  {
    id: 'metno_nordic',
    label: 'MET Norway Nordic',
    short: 'METNO',
    group: 'nordic',
    region: 'Nordics',
    resolution: '2.5 km',
    horizon: '2.5d',
  },
  {
    id: 'knmi_seamless',
    label: 'KNMI Seamless',
    short: 'KNMI',
    group: 'netherlands',
    region: 'Europe / NL',
    resolution: '2–5 km',
    horizon: '2.5d',
  },
  {
    id: 'knmi_harmonie_arome_europe',
    label: 'HARMONIE Europe',
    short: 'HAR·EU',
    group: 'netherlands',
    region: 'Europe',
    resolution: '5 km',
    horizon: '2.5d',
  },
  {
    id: 'knmi_harmonie_arome_netherlands',
    label: 'HARMONIE NL',
    short: 'HAR·NL',
    group: 'netherlands',
    region: 'Netherlands',
    resolution: '2 km',
    horizon: '2d',
  },
  {
    id: 'dmi_seamless',
    label: 'DMI Seamless',
    short: 'DMI',
    group: 'denmark',
    region: 'Europe / DK',
    resolution: '2–5 km',
    horizon: '2.5d',
  },
  {
    id: 'dmi_harmonie_arome_europe',
    label: 'DMI HARMONIE',
    short: 'DMI·H',
    group: 'denmark',
    region: 'Europe',
    resolution: '5 km',
    horizon: '2.5d',
  },
  {
    id: 'meteoswiss_icon_ch1',
    label: 'ICON-CH1',
    short: 'CH1',
    group: 'switzerland',
    region: 'Switzerland',
    resolution: '1 km',
    horizon: '1.5d',
  },
  {
    id: 'meteoswiss_icon_ch2',
    label: 'ICON-CH2',
    short: 'CH2',
    group: 'switzerland',
    region: 'Switzerland',
    resolution: '2 km',
    horizon: '5d',
  },
  {
    id: 'italia_meteo_arpae_icon_2i',
    label: 'ICON-2I',
    short: 'ICON·IT',
    group: 'italy',
    region: 'Italy',
    resolution: '2 km',
    horizon: '2d',
  },
];

export const MODEL_COLORS = [
  '#ff8a3d',
  '#4dd9ff',
  '#a78bfa',
  '#34d399',
  '#f472b6',
  '#fbbf24',
  '#60a5fa',
  '#fb7185',
];

export type ModelVariable =
  | 'temperature_2m'
  | 'precipitation'
  | 'precipitation_probability'
  | 'wind_speed_10m'
  | 'wind_gusts_10m'
  | 'relative_humidity_2m'
  | 'cloud_cover'
  | 'pressure_msl';

export const MODEL_VARIABLES: Array<{
  id: ModelVariable;
  label: string;
  short: string;
  unit: string;
}> = [
  { id: 'temperature_2m', label: 'Temperature', short: 'Temp', unit: '°F' },
  { id: 'precipitation', label: 'Precipitation', short: 'Precip', unit: 'in' },
  {
    id: 'precipitation_probability',
    label: 'Precip Probability',
    short: 'PoP',
    unit: '%',
  },
  { id: 'wind_speed_10m', label: 'Wind Speed', short: 'Wind', unit: 'mph' },
  { id: 'wind_gusts_10m', label: 'Wind Gusts', short: 'Gust', unit: 'mph' },
  {
    id: 'relative_humidity_2m',
    label: 'Humidity',
    short: 'RH',
    unit: '%',
  },
  { id: 'cloud_cover', label: 'Cloud Cover', short: 'Cloud', unit: '%' },
  { id: 'pressure_msl', label: 'Pressure', short: 'Pres', unit: 'hPa' },
];

export function defaultModelIds(): ModelId[] {
  return WEATHER_MODELS.filter((m) => m.defaultSelected).map((m) => m.id);
}

export function getModel(id: ModelId): WeatherModel | undefined {
  return WEATHER_MODELS.find((m) => m.id === id);
}
