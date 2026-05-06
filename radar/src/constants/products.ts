// Surface products for the left rail. Each row maps to either a NEXRAD
// product (radar overlay path) or a satellite GOES band (satellite path).
// Lightning is reserved for a future phase but listed here so the rail
// can show it as disabled.

import {
  ArrowUp,
  CloudRain,
  Cloudy,
  Droplets,
  Globe,
  Sun,
  Tornado,
  Wind,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ProductId =
  | 'refl'
  | 'vel'
  | 'srv'
  | 'tops'
  | 'vil'
  | 'comp'
  | 'sat-ir'
  | 'sat-vis'
  | 'lightning';

export interface ProductDef {
  id: ProductId;
  label: string;
  short: string;
  kind: 'radar' | 'satellite' | 'future';
  /** Sub-key used by the proxy to pick the upstream product. */
  proxyParam: string;
  icon: LucideIcon;
  disabled?: boolean;
}

export const PRODUCTS: ProductDef[] = [
  { id: 'refl',    label: 'Reflectivity',         short: 'BR',  kind: 'radar',     proxyParam: 'refl', icon: CloudRain },
  { id: 'vel',     label: 'Velocity',             short: 'BV',  kind: 'radar',     proxyParam: 'vel',  icon: Wind },
  { id: 'srv',     label: 'Storm-Rel Velocity',   short: 'SRV', kind: 'radar',     proxyParam: 'srv',  icon: Tornado },
  { id: 'tops',    label: 'Echo Tops',            short: 'ET',  kind: 'radar',     proxyParam: 'tops', icon: ArrowUp },
  { id: 'vil',     label: 'VIL',                  short: 'VIL', kind: 'radar',     proxyParam: 'vil',  icon: Droplets },
  { id: 'comp',    label: 'Composite',            short: 'CR',  kind: 'radar',     proxyParam: 'comp', icon: Cloudy },
  { id: 'sat-ir',  label: 'Satellite (IR)',       short: 'IR',  kind: 'satellite', proxyParam: 'ir',   icon: Globe },
  { id: 'sat-vis', label: 'Satellite (Visible)',  short: 'VIS', kind: 'satellite', proxyParam: 'vis',  icon: Sun },
  { id: 'lightning', label: 'Lightning (soon)',   short: 'LTG', kind: 'future',    proxyParam: '',     icon: Zap, disabled: true },
];

export const DEFAULT_PRODUCT: ProductId = 'refl';
