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
  | 'mosaic'
  | 'dwd'
  | 'windy'
  | 'gibs'
  | 'iowa-goes'
  | 'open-meteo-grid'
  | 'nullschool';

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

/** Rough local-solar night — VIS is useless / looks blank. */
export function isNightAt(lon: number, date = new Date()): boolean {
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60;
  const localSolarHour = (utcH + lon / 15 + 24) % 24;
  return localSolarHour < 6.25 || localSolarHour >= 18.75;
}

export function gibsGoesLayer(
  sector: 'east' | 'west',
  mode: 'ir' | 'vis',
): string {
  if (mode === 'vis') {
    return sector === 'west'
      ? 'GOES-West_ABI_Band2_Red_Visible_1km'
      : 'GOES-East_ABI_Band2_Red_Visible_1km';
  }
  return sector === 'west'
    ? 'GOES-West_ABI_Band13_Clean_Infrared'
    : 'GOES-East_ABI_Band13_Clean_Infrared';
}

export function iowaGoesProduct(
  sector: 'east' | 'west',
  mode: 'ir' | 'vis',
): string {
  if (mode === 'vis') {
    return sector === 'west'
      ? 'goes-west-vis-1km-900913'
      : 'goes-east-vis-1km-900913';
  }
  return sector === 'west'
    ? 'goes-west-ir-4km-900913'
    : 'goes-east-ir-4km-900913';
}

/** Remap GOES product codes when falling back between GIBS ↔ Iowa. */
export function remapGoesProduct(
  fromKind: SourceKind,
  toKind: SourceKind,
  product: string,
): string {
  if (fromKind === toKind) return product;
  const west = /west/i.test(product);
  const vis = /vis|visible|band2/i.test(product);
  const sector: 'east' | 'west' = west ? 'west' : 'east';
  const mode: 'ir' | 'vis' = vis ? 'vis' : 'ir';
  if (toKind === 'gibs') return gibsGoesLayer(sector, mode);
  if (toKind === 'iowa-goes') return iowaGoesProduct(sector, mode);
  return product;
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
      // Supercell-style: continental tiles at low zoom, NEXRAD L2 from z8+.
      if (zoom <= 7) {
        return {
          kind: 'rainviewer',
          product: 'radar',
          opacity: 0.78,
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

  // CONUS composite — Iowa XYZ (May 7), not OpenGeo cref WMS.
  if (product === 'composite') {
    if (isUS(region)) {
      if (zoom <= 10) {
        return {
          kind: 'iowa-state',
          product: 'nexrad-n0q-900913',
          opacity: 0.85,
          fallback: 'rainviewer',
        };
      }
      return {
        kind: 'ridge-wms',
        product: 'bref',
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

  if (product === 'echo-tops') {
    if (!isUS(region)) return UNAVAILABLE;
    return {
      kind: 'ridge-wms',
      product: 'neet',
      opacity: 0.8,
    };
  }

  if (product === 'precip-type') {
    if (!isUS(region)) return UNAVAILABLE;
    return { kind: 'ridge-wms', product: 'pcpn', opacity: 0.85 };
  }

  if (product === 'hydrometeor') {
    if (!isUS(region) || zoom < 7) return UNAVAILABLE;
    return { kind: 'ridge-wms', product: 'bdhc', opacity: 0.85 };
  }

  if (product === 'rainfall-1h') {
    if (!isUS(region) || zoom < 7) return UNAVAILABLE;
    return { kind: 'ridge-wms', product: 'boha', opacity: 0.85 };
  }

  if (product === 'storm-total') {
    if (!isUS(region) || zoom < 7) return UNAVAILABLE;
    return { kind: 'ridge-wms', product: 'bdsa', opacity: 0.85 };
  }

  if (product === 'velocity') {
    if (!isUS(region)) return UNAVAILABLE;
    // WeatherWise-style: CONUS mosaic / WMS at glance zoom, L2 when zoomed in.
    if (zoom <= 7) {
      return {
        kind: 'mosaic',
        product: 'bvel',
        opacity: 0.88,
        fallback: 'ridge-wms',
      };
    }
    if (zoom <= 9) {
      return {
        kind: 'ridge-wms',
        product: 'bvel',
        opacity: 0.9,
        fallback: 'mosaic',
      };
    }
    return {
      kind: 'level2',
      product: 'velocity',
      opacity: 0.92,
      fallback: 'ridge-wms',
    };
  }

  if (product === 'storm-rel-velocity') {
    if (!isUS(region)) return UNAVAILABLE;
    if (zoom <= 7) {
      return {
        kind: 'mosaic',
        product: 'n0s',
        opacity: 0.88,
        fallback: 'level3',
      };
    }
    return {
      kind: 'level3',
      product: 'N0S',
      opacity: 0.9,
      fallback: 'mosaic',
    };
  }

  if (product === 'rotation') {
    if (!isUS(region)) return UNAVAILABLE;
    if (zoom <= 7) {
      return {
        kind: 'mosaic',
        product: 'rot',
        opacity: 0.88,
        fallback: 'level3',
      };
    }
    return { kind: 'level3', product: 'ROT', opacity: 0.9, fallback: 'mosaic' };
  }

  if (product === 'correlation') {
    if (!isUS(region)) return UNAVAILABLE;
    if (zoom <= 7) {
      return {
        kind: 'mosaic',
        product: 'n0c',
        opacity: 0.85,
        fallback: 'level3',
      };
    }
    return {
      kind: 'level2',
      product: 'correlation',
      opacity: 0.9,
      fallback: 'level3',
    };
  }

  if (product === 'satellite-ir') {
    // Prefer NASA GIBS — Iowa Mesonet IR is near-black (median ~30) and
    // reads as a blank map on dark basemaps. Keep Iowa as a fallback.
    return {
      kind: 'gibs',
      product: gibsGoesLayer(sector, 'ir'),
      opacity: 0.82,
      fallback: 'iowa-goes',
    };
  }

  if (product === 'satellite-vis') {
    // Night VIS is nearly black — serve IR so the map isn't empty.
    if (isNightAt(lon)) {
      return {
        kind: 'gibs',
        product: gibsGoesLayer(sector, 'ir'),
        opacity: 0.82,
        fallback: 'iowa-goes',
      };
    }
    return {
      kind: 'gibs',
      product: gibsGoesLayer(sector, 'vis'),
      opacity: 0.78,
      fallback: 'iowa-goes',
    };
  }

  if (product === 'wind') {
    return { kind: 'nullschool', product: 'wind', opacity: 0 };
  }
  if (product === 'temperature') {
    return { kind: 'nullschool', product: 'temp', opacity: 0 };
  }
  if (product === 'rain-forecast') {
    return { kind: 'nullschool', product: 'precip', opacity: 0 };
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
      product === 'rotation' ||
      product === 'correlation' ||
      product === 'echo-tops' ||
      product === 'precip-type' ||
      product === 'hydrometeor' ||
      product === 'rainfall-1h' ||
      product === 'storm-total') &&
    !isUS(region)
  ) {
    return 'Unavailable in this region. US NEXRAD / MRMS only.';
  }
  if (
    (product === 'hydrometeor' ||
      product === 'rainfall-1h' ||
      product === 'storm-total') &&
    zoom < 7
  ) {
    return 'Zoom in further (z7+) to load this single-radar product.';
  }
  return null;
}
