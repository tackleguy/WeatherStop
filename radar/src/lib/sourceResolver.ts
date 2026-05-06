// Zoom-aware radar source resolver. Given the current map state, returns
// which backend source the next layer fetch should hit. The frontend hook
// (useRadarLayers) is responsible for the actual fetch + crossfade.

import { nearestSite, type NexradSite } from './nexradSites';

export interface StormCell {
  id: string;
  lon: number;
  lat: number;
}

export type SourcePlan =
  | { source: 'WINDY'; product: 'radar' }
  | { source: 'L3'; site: NexradSite; product: string }
  | { source: 'L2'; site: NexradSite; product: string };

export interface ResolverInput {
  zoom: number;
  centerLon: number;
  centerLat: number;
  focusedStorm: StormCell | null;
  selectedProduct: string; // L3/L2 product code (e.g. p19r0)
}

// Picks the highest-detail source available for the current zoom + focus.
// Threshold reasoning:
//   < 8   → continental composite (Windy) is faster and renders smoothly
//   8-10  → L3 from the nearest NEXRAD site (~230 km radial range)
//   ≥ 11  → L2 base reflectivity (250 m gates, fine storm detail)
//   focusedStorm → always L2 of the storm's nearest site
export function pickRadarSource(input: ResolverInput): SourcePlan {
  const { zoom, centerLon, centerLat, focusedStorm, selectedProduct } = input;

  if (focusedStorm) {
    return {
      source: 'L2',
      site: nearestSite(focusedStorm.lon, focusedStorm.lat),
      product: selectedProduct,
    };
  }
  if (zoom >= 11) {
    return {
      source: 'L2',
      site: nearestSite(centerLon, centerLat),
      product: selectedProduct,
    };
  }
  if (zoom >= 8) {
    return {
      source: 'L3',
      site: nearestSite(centerLon, centerLat),
      product: selectedProduct,
    };
  }
  return { source: 'WINDY', product: 'radar' };
}

// Stable key so React effects can detect "the plan actually changed".
export function planKey(plan: SourcePlan): string {
  if (plan.source === 'WINDY') return 'WINDY';
  return `${plan.source}:${plan.site.id}:${plan.product}`;
}
