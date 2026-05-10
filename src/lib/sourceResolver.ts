// The source resolver decides which upstream service should serve the
// active product at the current zoom + region. Each branch returns a
// SourceChoice describing the endpoint kind, the upstream product code,
// the target opacity, and an optional fallback when the primary fails.
//
// The contract:
//
//   • opacity === 0 means "this product isn't available here" — the
//     orchestrator hides the layer and the LayerInfoCard shows a banner
//     explaining the limitation. We deliberately don't throw because
//     the user can still pan to a covered region without a remount.
//   • A populated `fallback` is the orchestrator's hint that if the
//     primary 404s or returns blank tiles, it should try the fallback
//     before giving up.

import type { ProductId } from '../constants/products';
import { type Region, isUS } from './regionDetect';

export type SourceKind =
  | 'iowa-state'
  | 'rainviewer'
  | 'ridge-wms'
  | 'level2'
  | 'dwd'
  | 'windy'
  | 'gibs-ir'
  | 'iowa-goes-vis'
  | 'open-meteo-grid';

export interface SourceChoice {
  kind: SourceKind;
  product: string;
  opacity: number;
  fallback?: SourceKind;
}

export const UNAVAILABLE: SourceChoice = {
  kind: 'rainviewer',
  product: 'radar',
  opacity: 0,
};

export function resolveSource(
  product: ProductId,
  zoom: number,
  region: Region,
): SourceChoice {
  if (product === 'reflectivity' || product === 'composite') {
    if (isUS(region)) {
      if (zoom <= 9) {
        return {
          kind: 'iowa-state',
          product: 'nexrad-n0q-900913',
          opacity: 0.85,
        };
      }
      if (zoom <= 11) {
        return {
          kind: 'ridge-wms',
          product: 'bref',
          opacity: 0.9,
          fallback: 'iowa-state',
        };
      }
      return {
        kind: 'level2',
        product: 'reflectivity',
        opacity: 0.92,
        fallback: 'ridge-wms',
      };
    }
    if (region === 'EU-DE' && zoom >= 5) {
      return {
        kind: 'dwd',
        product: 'Niederschlagsradar',
        opacity: 0.85,
        fallback: 'rainviewer',
      };
    }
    return {
      kind: 'rainviewer',
      product: 'radar',
      opacity: 0.8,
      fallback: 'windy',
    };
  }

  if (product === 'velocity' || product === 'storm-rel-velocity') {
    if (!isUS(region)) return UNAVAILABLE;
    if (zoom <= 11) {
      return { kind: 'ridge-wms', product: 'bvel', opacity: 0.9 };
    }
    return {
      kind: 'level2',
      product: 'velocity',
      opacity: 0.92,
      fallback: 'ridge-wms',
    };
  }

  if (product === 'correlation') {
    if (!isUS(region) || zoom < 8) return UNAVAILABLE;
    return { kind: 'level2', product: 'correlation', opacity: 0.9 };
  }

  // GOES IR via NASA GIBS — global coverage, WMTS, no key. We used to
  // route this through RainViewer, but RainViewer's free manifest no
  // longer publishes a satellite.infrared frame list (verified
  // 2026-05-10). NOAA's old mapservices GOES animation was also pulled.
  if (product === 'satellite-ir') {
    return { kind: 'gibs-ir', product: 'GOES-East_ABI_Band13_Clean_Infrared', opacity: 0.7 };
  }
  if (product === 'satellite-vis') {
    if (isUS(region)) {
      // Iowa State Mesonet GOES visible (1km, US-east coverage).
      return {
        kind: 'iowa-goes-vis',
        product: 'goes-east-vis-1km-900913',
        opacity: 0.85,
        fallback: 'gibs-ir',
      };
    }
    // Outside CONUS: visible band isn't available globally without a
    // paid GOES feed. Fall back to GIBS IR so the user still sees
    // cloud structure.
    return { kind: 'gibs-ir', product: 'GOES-East_ABI_Band13_Clean_Infrared', opacity: 0.7 };
  }

  if (product === 'wind') {
    return { kind: 'open-meteo-grid', product: 'wind', opacity: 0.6 };
  }
  if (product === 'temperature') {
    return { kind: 'open-meteo-grid', product: 'temperature', opacity: 0.6 };
  }

  return UNAVAILABLE;
}

// Region-product compatibility — used by the LayerInfoCard banner so we
// can name the limitation precisely instead of just "no data".
export function unavailabilityReason(
  product: ProductId,
  zoom: number,
  region: Region,
): string | null {
  if (
    (product === 'velocity' || product === 'storm-rel-velocity') &&
    !isUS(region)
  ) {
    return 'Velocity unavailable in this region. US NEXRAD only.';
  }
  if (product === 'correlation' && !isUS(region)) {
    return 'Correlation Coefficient unavailable in this region. US NEXRAD only.';
  }
  if (product === 'correlation' && zoom < 8) {
    return 'Zoom in further (z8+) to load Correlation Coefficient.';
  }
  return null;
}
