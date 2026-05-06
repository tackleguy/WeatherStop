import {
  ArrowUpRight,
  CloudRain,
  Cloudy,
  Droplets,
  Globe,
  Sun,
  Thermometer,
  Tornado,
  Wind,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ProductId =
  | 'reflectivity'
  | 'velocity'
  | 'storm-rel-velocity'
  | 'echo-tops'
  | 'vil'
  | 'composite'
  | 'satellite-ir'
  | 'satellite-vis'
  | 'lightning'
  | 'temperature';

export type LayerSource = 'windy' | 'nws-overlay' | 'placeholder';
export type LegendKind = 'dbz' | 'kts' | 'satellite' | 'temp' | 'none';

export interface Product {
  id: ProductId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  layer: LayerSource;
  /** Windy product slug (when layer === 'windy'). */
  windyProduct?: string;
  /** NOAA mapservices ImageServer name (when layer === 'nws-overlay'). */
  nwsProduct?: string;
  legend: LegendKind;
  description: string;
  /** Disabled below this map zoom level. */
  requiresZoom?: number;
}

export const PRODUCTS: Product[] = [
  {
    id: 'reflectivity',
    label: 'Reflectivity',
    shortLabel: 'REFL',
    icon: CloudRain,
    layer: 'windy',
    windyProduct: 'radar',
    legend: 'dbz',
    description: 'Precipitation intensity (composite)',
  },
  {
    id: 'velocity',
    label: 'Base Velocity',
    shortLabel: 'VEL',
    icon: Wind,
    layer: 'nws-overlay',
    nwsProduct: 'radar_base_velocity_time',
    legend: 'kts',
    description: 'Wind toward / away from radar',
  },
  {
    id: 'storm-rel-velocity',
    label: 'Storm-Rel Velocity',
    shortLabel: 'SRV',
    icon: Tornado,
    layer: 'nws-overlay',
    nwsProduct: 'radar_storm_rel_velocity_time',
    legend: 'kts',
    description: 'Velocity relative to storm motion',
    requiresZoom: 6,
  },
  {
    id: 'echo-tops',
    label: 'Echo Tops',
    shortLabel: 'ET',
    icon: ArrowUpRight,
    layer: 'nws-overlay',
    nwsProduct: 'radar_echo_tops_time',
    legend: 'none',
    description: 'Storm cloud top heights',
  },
  {
    id: 'vil',
    label: 'VIL',
    shortLabel: 'VIL',
    icon: Droplets,
    layer: 'nws-overlay',
    nwsProduct: 'radar_vil_time',
    legend: 'none',
    description: 'Vertically Integrated Liquid',
  },
  {
    id: 'composite',
    label: 'Composite Refl',
    shortLabel: 'CR',
    icon: Cloudy,
    layer: 'windy',
    windyProduct: 'radar',
    legend: 'dbz',
    description: 'Maximum reflectivity in column',
  },
  {
    id: 'satellite-ir',
    label: 'Satellite (IR)',
    shortLabel: 'IR',
    icon: Globe,
    layer: 'windy',
    windyProduct: 'satellite',
    legend: 'satellite',
    description: 'Infrared, day/night cloud coverage',
  },
  {
    id: 'satellite-vis',
    label: 'Satellite (Visible)',
    shortLabel: 'VIS',
    icon: Sun,
    layer: 'windy',
    windyProduct: 'satellite',
    legend: 'satellite',
    description: 'True-color daytime',
  },
  {
    id: 'temperature',
    label: 'Temperature',
    shortLabel: 'TEMP',
    icon: Thermometer,
    layer: 'windy',
    windyProduct: 'temp',
    legend: 'temp',
    description: 'Surface temperature',
  },
  {
    id: 'lightning',
    label: 'Lightning',
    shortLabel: 'LTG',
    icon: Zap,
    layer: 'placeholder',
    legend: 'none',
    description: 'Coming soon',
  },
];

export const DEFAULT_PRODUCT: ProductId = 'reflectivity';

export function getProduct(id: ProductId): Product {
  return PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0];
}
