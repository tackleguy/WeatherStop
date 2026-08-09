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

/** Rough local-solar night — VIS is useless / looks blank. */
export function isNightAt(lon: number, date = new Date()): boolean {
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60;
  const localSolarHour = (utcH + lon / 15 + 24) % 24;
  return localSolarHour < 6.25 || localSolarHour >= 18.75;
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
      // OpenGeo CONUS base reflectivity (national mosaic), then Iowa XYZ,
      // then single-site / Level 2 as you zoom in.
      if (zoom <= 9) {
        return {
          kind: 'ridge-wms',
          product: 'conus-bref',
          opacity: 0.85,
          fallback: 'iowa-state',
        };
      }
      if (zoom <= 11) {
        return {
          kind: 'iowa-state',
          product: 'nexrad-n0q-900913',
          opacity: 0.85,
          fallback: 'rainviewer',
        };
      }
      if (zoom <= 13) {
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
      if (zoom <= 10) {
        return {
          kind: 'ridge-wms',
          product: 'cref',
          opacity: 0.85,
          fallback: 'iowa-state',
        };
      }
      return {
        kind: 'iowa-state',
        product: 'nexrad-n0q-900913',
        opacity: 0.9,
        fallback: 'rainviewer',
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
    // Multi-site OpenGeo mosaic works from CONUS; refine to one site later.
    if (zoom <= 9) {
      return {
        kind: 'mosaic',
        product: 'bvel',
        opacity: 0.9,
        fallback: 'ridge-wms',
      };
    }
    if (zoom <= 12) {
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

  if (product === 'storm-rel-velocity') {
    if (!isUS(region)) return UNAVAILABLE;
    if (zoom <= 8) {
      // No single-site fallback at CONUS — one radar still looks blank.
      return { kind: 'mosaic', product: 'n0s', opacity: 0.9 };
    }
    return { kind: 'level3', product: 'N0S', opacity: 0.9 };
  }

  if (product === 'rotation') {
    if (!isUS(region)) return UNAVAILABLE;
    if (zoom <= 8) {
      return { kind: 'mosaic', product: 'rot', opacity: 0.9 };
    }
    return { kind: 'level3', product: 'ROT', opacity: 0.9 };
  }

  if (product === 'correlation') {
    if (!isUS(region)) return UNAVAILABLE;
    // CONUS: multi-site Level 3 N0C mosaic. Zoomed in: single-site L3
    // (L2 CC is available as fallback once the volume parses).
    if (zoom <= 9) {
      return {
        kind: 'mosaic',
        product: 'n0c',
        opacity: 0.9,
        fallback: 'level3',
      };
    }
    return {
      kind: 'level3',
      product: 'N0C',
      opacity: 0.9,
      fallback: 'level2',
    };
  }

  if (product === 'satellite-ir') {
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
    // RainViewer satellite.infrared is often empty — don't rely on it.
    return {
      kind: 'gibs',
      product: layer,
      opacity: 0.7,
    };
  }

  if (product === 'satellite-vis') {
    // Night VIS is nearly black — serve IR so the map isn't empty.
    if (isNightAt(lon)) {
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
      return { kind: 'gibs', product: layer, opacity: 0.7 };
    }
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
