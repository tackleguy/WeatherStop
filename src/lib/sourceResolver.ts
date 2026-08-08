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
  | 'level3'
  | 'dwd'
  | 'windy'
  | 'gibs'
  | 'iowa-goes'
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

/** Pick GOES-East vs West by longitude (~105°W divide). */
export function goesSector(lon: number): 'east' | 'west' {
  return lon < -105 ? 'west' : 'east';
}

export function resolveSource(
  product: ProductId,
  zoom: number,
  region: Region,
  lon = -97,
): SourceChoice {
  const sector = goesSector(lon);

  if (product === 'reflectivity') {
    if (isUS(region)) {
      if (zoom <= 9) {
        return {
          kind: 'iowa-state',
          product: 'nexrad-n0q-900913',
          opacity: 0.85,
          fallback: 'rainviewer',
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
    };
  }

  // CONUS composite mosaic — distinct from single-tilt reflectivity.
  if (product === 'composite') {
    if (isUS(region)) {
      if (zoom <= 8) {
        return {
          kind: 'iowa-state',
          product: 'nexrad-n0q-900913',
          opacity: 0.85,
          fallback: 'rainviewer',
        };
      }
      return {
        kind: 'ridge-wms',
        product: 'cref',
        opacity: 0.9,
        fallback: 'iowa-state',
      };
    }
    return {
      kind: 'rainviewer',
      product: 'radar',
      opacity: 0.8,
    };
  }

  if (product === 'velocity') {
    if (!isUS(region)) return UNAVAILABLE;
    // Single-site velocity is useless at continental zoom — require
    // close enough that the site disc fills a meaningful share of the map.
    if (zoom < 7) return UNAVAILABLE;
    if (zoom <= 11) {
      return {
        kind: 'ridge-wms',
        product: 'bvel',
        opacity: 0.9,
        fallback: 'level2',
      };
    }
    return {
      kind: 'level2',
      product: 'velocity',
      opacity: 0.92,
      fallback: 'ridge-wms',
    };
  }

  // True storm-relative via Unidata Level 3 N0S (not base velocity).
  if (product === 'storm-rel-velocity') {
    if (!isUS(region) || zoom < 6) return UNAVAILABLE;
    return {
      kind: 'level3',
      product: 'N0S',
      opacity: 0.9,
    };
  }

  // Azimuthal shear derived from Level 3 N0S.
  if (product === 'rotation') {
    if (!isUS(region) || zoom < 6) return UNAVAILABLE;
    return {
      kind: 'level3',
      product: 'ROT',
      opacity: 0.9,
    };
  }

  if (product === 'correlation') {
    if (!isUS(region) || zoom < 8) return UNAVAILABLE;
    return { kind: 'level2', product: 'correlation', opacity: 0.9 };
  }

  if (product === 'satellite-ir') {
    // Iowa GOES IR tiles are the most reliable free CONUS source.
    // GIBS covers global / ocean when outside US (or as fallback).
    if (isUS(region)) {
      const iowa =
        sector === 'west'
          ? 'goes-west-ir-4km-900913'
          : 'goes-east-ir-4km-900913';
      return {
        kind: 'iowa-goes',
        product: iowa,
        opacity: 0.75,
        fallback: 'gibs',
      };
    }
    const layer =
      sector === 'west'
        ? 'GOES-West_ABI_Band13_Clean_Infrared'
        : 'GOES-East_ABI_Band13_Clean_Infrared';
    return {
      kind: 'gibs',
      product: layer,
      opacity: 0.7,
      fallback: 'rainviewer',
    };
  }

  if (product === 'satellite-vis') {
    if (isUS(region)) {
      const iowa =
        sector === 'west'
          ? 'goes-west-vis-1km-900913'
          : 'goes-east-vis-1km-900913';
      return {
        kind: 'iowa-goes',
        product: iowa,
        opacity: 0.85,
        fallback: 'gibs',
      };
    }
    const layer =
      sector === 'west'
        ? 'GOES-West_ABI_Band2_Red_Visible_1km'
        : 'GOES-East_ABI_Band2_Red_Visible_1km';
    return { kind: 'gibs', product: layer, opacity: 0.7 };
  }

  if (product === 'wind') {
    return { kind: 'open-meteo-grid', product: 'wind', opacity: 0.6 };
  }
  if (product === 'temperature') {
    return { kind: 'open-meteo-grid', product: 'temperature', opacity: 0.6 };
  }

  return UNAVAILABLE;
}

export function unavailabilityReason(
  product: ProductId,
  zoom: number,
  region: Region,
): string | null {
  if (
    (product === 'velocity' ||
      product === 'storm-rel-velocity' ||
      product === 'rotation') &&
    !isUS(region)
  ) {
    return 'Unavailable in this region. US NEXRAD only.';
  }
  if (product === 'velocity' && zoom < 7) {
    return 'Zoom in further (z7+) to load Base Velocity for a nearby radar.';
  }
  if (
    (product === 'storm-rel-velocity' || product === 'rotation') &&
    zoom < 6
  ) {
    return 'Zoom in further (z6+) to load this product.';
  }
  if (product === 'correlation' && !isUS(region)) {
    return 'Correlation Coefficient unavailable in this region. US NEXRAD only.';
  }
  if (product === 'correlation' && zoom < 8) {
    return 'Zoom in further (z8+) to load Correlation Coefficient.';
  }
  return null;
}
