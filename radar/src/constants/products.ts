// Radar products surfaced in the left rail. Each maps to a concrete
// NEXRAD Level III/II product code on the backend. Visual codes (palette,
// label) live alongside so the rail can render without round-trips.

import {
  Activity,
  CloudRain,
  Compass,
  Layers,
  Radar,
  Waves,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ProductId =
  | 'reflectivity'
  | 'velocity'
  | 'storm_relative_velocity'
  | 'spectrum_width'
  | 'echo_tops'
  | 'vil'
  | 'composite_reflectivity';

export interface ProductDef {
  id: ProductId;
  label: string;
  short: string;
  l3Code: string; // NWS L3 endpoint segment, e.g. p19r0 = base reflectivity
  l2Product: 'reflectivity' | 'velocity' | 'spectrum_width';
  icon: LucideIcon;
}

export const PRODUCTS: ProductDef[] = [
  {
    id: 'reflectivity',
    label: 'Base Reflectivity',
    short: 'BR',
    l3Code: 'p19r0',
    l2Product: 'reflectivity',
    icon: Radar,
  },
  {
    id: 'velocity',
    label: 'Base Velocity',
    short: 'BV',
    l3Code: 'p27v0',
    l2Product: 'velocity',
    icon: Compass,
  },
  {
    id: 'storm_relative_velocity',
    label: 'Storm-Relative Velocity',
    short: 'SRV',
    l3Code: 'p56r0',
    l2Product: 'velocity',
    icon: Activity,
  },
  {
    id: 'spectrum_width',
    label: 'Spectrum Width',
    short: 'SW',
    l3Code: 'p30sw',
    l2Product: 'spectrum_width',
    icon: Waves,
  },
  {
    id: 'echo_tops',
    label: 'Echo Tops',
    short: 'ET',
    l3Code: 'p41et',
    l2Product: 'reflectivity',
    icon: Zap,
  },
  {
    id: 'vil',
    label: 'Vert. Integrated Liquid',
    short: 'VIL',
    l3Code: 'p57vil',
    l2Product: 'reflectivity',
    icon: CloudRain,
  },
  {
    id: 'composite_reflectivity',
    label: 'Composite Reflectivity',
    short: 'CR',
    l3Code: 'p38cr',
    l2Product: 'reflectivity',
    icon: Layers,
  },
];

export const DEFAULT_PRODUCT: ProductId = 'reflectivity';

// NWS standard reflectivity palette (dBZ → color). Numeric values; not
// copyrighted. Used by both Windy fallback and L3/L2 renders for visual
// continuity. dBZ is binned to 5 dBZ steps.
export const REFLECTIVITY_PALETTE: Array<[number, string]> = [
  [-32, 'rgba(0,0,0,0)'],
  [5, '#04e9e7'],
  [10, '#019ff4'],
  [15, '#0300f4'],
  [20, '#02fd02'],
  [25, '#01c501'],
  [30, '#008e00'],
  [35, '#fdf802'],
  [40, '#e5bc00'],
  [45, '#fd9500'],
  [50, '#fd0000'],
  [55, '#d40000'],
  [60, '#bc0000'],
  [65, '#f800fd'],
  [70, '#9854c6'],
];
