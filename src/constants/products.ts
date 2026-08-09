// The radar product catalog. Each entry describes one toggle in the
// product rail; the actual upstream picked at runtime is decided by
// `lib/sourceResolver.ts` based on zoom + region.

import {
  Atom,
  CloudRain,
  Cloudy,
  CloudSnow,
  Droplets,
  Layers,
  Mountain,
  RotateCw,
  Sun,
  Thermometer,
  Tornado,
  Wind,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ProductId =
  | 'reflectivity'
  | 'composite'
  | 'echo-tops'
  | 'precip-type'
  | 'velocity'
  | 'storm-rel-velocity'
  | 'rotation'
  | 'correlation'
  | 'hydrometeor'
  | 'rainfall-1h'
  | 'storm-total'
  | 'satellite-ir'
  | 'satellite-vis'
  | 'wind'
  | 'temperature';

export type ProductGroup = 'radar' | 'satellite' | 'surface';

export type LegendKind =
  | 'dbz'
  | 'kts'
  | 'rho'
  | 'shear'
  | 'echo'
  | 'ptype'
  | 'rain'
  | 'hhc'
  | 'satellite'
  | 'wind'
  | 'temp'
  | 'none';

export interface Product {
  id: ProductId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  legend: LegendKind;
  description: string;
  group: ProductGroup;
  /** Disabled below this map zoom level. */
  requiresZoom?: number;
}

export const PRODUCT_GROUP_LABELS: Record<ProductGroup, string> = {
  radar: 'Radar',
  satellite: 'Satellite',
  surface: 'Surface',
};

export const PRODUCTS: Product[] = [
  {
    id: 'reflectivity',
    label: 'Reflectivity',
    shortLabel: 'REFL',
    icon: CloudRain,
    legend: 'dbz',
    description: 'Precipitation intensity',
    group: 'radar',
  },
  {
    id: 'composite',
    label: 'Composite',
    shortLabel: 'COMP',
    icon: Layers,
    legend: 'dbz',
    description: 'CONUS column-max reflectivity',
    group: 'radar',
  },
  {
    id: 'echo-tops',
    label: 'Echo Tops',
    shortLabel: 'TOPS',
    icon: Mountain,
    legend: 'echo',
    description: 'Storm top height (MRMS)',
    group: 'radar',
  },
  {
    id: 'precip-type',
    label: 'Precip Type',
    shortLabel: 'PTYPE',
    icon: CloudSnow,
    legend: 'ptype',
    description: 'Rain / snow / ice / mix (MRMS)',
    group: 'radar',
  },
  {
    id: 'velocity',
    label: 'Base Velocity',
    shortLabel: 'VEL',
    icon: Wind,
    legend: 'kts',
    description: 'Wind toward / away from radar (US only)',
    group: 'radar',
  },
  {
    id: 'storm-rel-velocity',
    label: 'Storm-Rel Velocity',
    shortLabel: 'SRV',
    icon: Tornado,
    legend: 'kts',
    description: 'Velocity relative to storm motion (US only)',
    group: 'radar',
  },
  {
    id: 'rotation',
    label: 'Rotation',
    shortLabel: 'ROT',
    icon: RotateCw,
    legend: 'shear',
    description: 'Azimuthal shear from storm-relative velocity (US only)',
    group: 'radar',
  },
  {
    id: 'correlation',
    label: 'Correlation Coefficient',
    shortLabel: 'CC',
    icon: Atom,
    legend: 'rho',
    description: 'Hail / debris detection (US only)',
    group: 'radar',
  },
  {
    id: 'hydrometeor',
    label: 'Hydrometeor Class',
    shortLabel: 'HHC',
    icon: Droplets,
    legend: 'hhc',
    description: 'Dual-pol precip classification (US site)',
    group: 'radar',
    requiresZoom: 7,
  },
  {
    id: 'rainfall-1h',
    label: '1-Hour Rainfall',
    shortLabel: '1HR',
    icon: CloudRain,
    legend: 'rain',
    description: '1-hour accumulation (US site)',
    group: 'radar',
    requiresZoom: 7,
  },
  {
    id: 'storm-total',
    label: 'Storm Total',
    shortLabel: 'STP',
    icon: Droplets,
    legend: 'rain',
    description: 'Storm-total precipitation (US site)',
    group: 'radar',
    requiresZoom: 7,
  },
  {
    id: 'satellite-ir',
    label: 'Satellite (IR)',
    shortLabel: 'IR',
    icon: Cloudy,
    legend: 'satellite',
    description: 'Infrared cloud cover',
    group: 'satellite',
  },
  {
    id: 'satellite-vis',
    label: 'Satellite (Visible)',
    shortLabel: 'VIS',
    icon: Sun,
    legend: 'satellite',
    description: 'Visible cloud cover (best US)',
    group: 'satellite',
  },
  {
    id: 'wind',
    label: 'Wind',
    shortLabel: 'WIND',
    icon: Wind,
    legend: 'wind',
    description: 'Surface wind speed (forecast)',
    group: 'surface',
  },
  {
    id: 'temperature',
    label: 'Temperature',
    shortLabel: 'TEMP',
    icon: Thermometer,
    legend: 'temp',
    description: 'Surface temperature (forecast)',
    group: 'surface',
  },
];

export const DEFAULT_PRODUCT: ProductId = 'reflectivity';

export function getProduct(id: ProductId): Product {
  return PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0];
}
