// The radar product catalog. Each entry describes one toggle in the
// product rail; the actual upstream picked at runtime is decided by
// `lib/sourceResolver.ts` based on zoom + region. Products marked with
// `requiresZoom` are dimmed on the rail until the user zooms in far
// enough to see useful data.

import {
  Atom,
  CloudRain,
  Cloudy,
  Sun,
  Thermometer,
  Tornado,
  Wind,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ProductId =
  | 'reflectivity'
  | 'velocity'
  | 'storm-rel-velocity'
  | 'correlation'
  | 'satellite-ir'
  | 'satellite-vis'
  | 'wind'
  | 'temperature'
  | 'composite';

export type LegendKind =
  | 'dbz'
  | 'kts'
  | 'rho'
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
  /** Disabled below this map zoom level. */
  requiresZoom?: number;
}

export const PRODUCTS: Product[] = [
  {
    id: 'reflectivity',
    label: 'Reflectivity',
    shortLabel: 'REFL',
    icon: CloudRain,
    legend: 'dbz',
    description: 'Precipitation intensity',
  },
  {
    id: 'velocity',
    label: 'Base Velocity',
    shortLabel: 'VEL',
    icon: Wind,
    legend: 'kts',
    description: 'Wind toward / away from radar (US only)',
  },
  {
    id: 'storm-rel-velocity',
    label: 'Storm-Rel Velocity',
    shortLabel: 'SRV',
    icon: Tornado,
    legend: 'kts',
    description: 'Velocity relative to storm motion (US only)',
    requiresZoom: 6,
  },
  {
    id: 'correlation',
    label: 'Correlation Coefficient',
    shortLabel: 'CC',
    icon: Atom,
    legend: 'rho',
    description: 'Hail / debris detection (US, zoom 8+)',
    requiresZoom: 8,
  },
  {
    id: 'satellite-ir',
    label: 'Satellite (IR)',
    shortLabel: 'IR',
    icon: Cloudy,
    legend: 'satellite',
    description: 'Infrared cloud cover (global)',
  },
  {
    id: 'satellite-vis',
    label: 'Satellite (Visible)',
    shortLabel: 'VIS',
    icon: Sun,
    legend: 'satellite',
    description: 'Visible cloud cover (best US)',
  },
  {
    id: 'wind',
    label: 'Wind',
    shortLabel: 'WIND',
    icon: Wind,
    legend: 'wind',
    description: 'Surface wind speed (forecast)',
  },
  {
    id: 'temperature',
    label: 'Temperature',
    shortLabel: 'TEMP',
    icon: Thermometer,
    legend: 'temp',
    description: 'Surface temperature (forecast)',
  },
];

export const DEFAULT_PRODUCT: ProductId = 'reflectivity';

export function getProduct(id: ProductId): Product {
  return PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0];
}
