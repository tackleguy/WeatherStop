// Layer orchestration for the radar map. Picks the best available
// source per zoom + product and crossfades between them. Sources:
//
//   • RainViewer raster tiles  — global, fast, low-zoom default
//   • Iowa State Mesonet      — CONUS composite, sharper at z 8-9
//   • Per-site NWS WMS        — native-resolution refl/vel at z ≥ 10
//                              (also: velocity at any zoom)
//   • NOAA mapservices NWS    — echo tops, VIL, etc.
//
// Each source has stable IDs so RadarMap can layer alerts above them
// in any order. The user-facing opacity slider multiplies whatever
// target opacity the resolver picks.

import { useEffect, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { fadeRasterTo } from '../lib/crossfade';
import { getProduct, type ProductId } from '../constants/products';
import {
  buildTileUrl,
  placeholderTileUrl,
  type RainViewerCatalog,
} from '../lib/rainviewer';
import {
  nearestNexradSite,
  type NexradSite,
} from '../lib/nexradSites';
import { useRadarStore } from '../store/useRadarStore';
import { useWmsSiteLayer } from './useWmsSiteLayer';

export const RAINVIEWER_SOURCE = 'rainviewer-tiles';
export const RAINVIEWER_LAYER = 'rainviewer-layer';
export const IOWA_SOURCE = 'iowa-tiles';
export const IOWA_LAYER = 'iowa-layer';
export const NWS_SOURCE = 'nws-overlay';
export const NWS_LAYER = 'nws-overlay-layer';

export type SourceKind =
  | 'rainviewer-radar'
  | 'rainviewer-satellite'
  | 'iowa'
  | 'wms-site'
  | 'nws-overlay'
  | 'placeholder';

export interface SourcePlan {
  kind: SourceKind;
  /** Human-readable label for the layer-info chip. */
  label: string;
  /** Where the data comes from (for the attribution chip). */
  attribution: string;
  /** Target opacity (before user multiplier). */
  opacity: number;
  /** Set when kind === 'wms-site'. */
  site?: NexradSite;
  /** Per-site WMS product when applicable. */
  wmsProduct?: 'bref' | 'bvel';
  /** NWS mapservices ImageServer name (for echo tops / VIL). */
  nwsService?: string;
}

export function pickRadarSource(
  zoom: number,
  lon: number,
  lat: number,
  productId: ProductId,
): SourcePlan {
  // Velocity products: per-site WMS bvel at any zoom.
  if (productId === 'velocity' || productId === 'storm-rel-velocity') {
    const site = nearestNexradSite(lon, lat);
    return {
      kind: 'wms-site',
      label: `${site.id} · Base Velocity`,
      attribution: '© <a href="https://www.weather.gov" target="_blank" rel="noopener">NWS</a>',
      opacity: 0.9,
      site,
      wmsProduct: 'bvel',
    };
  }

  // Echo tops / VIL / temperature still use the existing NWS overlay
  // image source — those products don't have a per-site WMS we ship.
  const product = getProduct(productId);
  if (product.layer === 'nws-overlay' && product.nwsProduct) {
    return {
      kind: 'nws-overlay',
      label: product.label,
      attribution: '© <a href="https://www.weather.gov" target="_blank" rel="noopener">NWS</a>',
      opacity: 0.85,
      nwsService: product.nwsProduct,
    };
  }

  // Satellite → RainViewer satellite tiles.
  if (productId === 'satellite-ir' || productId === 'satellite-vis') {
    return {
      kind: 'rainviewer-satellite',
      label: 'Satellite (RainViewer)',
      attribution:
        '© <a href="https://rainviewer.com" target="_blank" rel="noopener">RainViewer</a>',
      opacity: 0.85,
    };
  }

  // Reflectivity / composite — zoom-routed.
  if (zoom <= 7) {
    return {
      kind: 'rainviewer-radar',
      label: 'Reflectivity (RainViewer)',
      attribution:
        '© <a href="https://rainviewer.com" target="_blank" rel="noopener">RainViewer</a>',
      opacity: 0.78,
    };
  }
  if (zoom <= 9) {
    return {
      kind: 'iowa',
      label: 'NEXRAD Composite (Iowa State)',
      attribution:
        '© <a href="https://mesonet.agron.iastate.edu" target="_blank" rel="noopener">Iowa State Mesonet</a>',
      opacity: 0.85,
    };
  }
  const site = nearestNexradSite(lon, lat);
  return {
    kind: 'wms-site',
    label: `${site.id} · Reflectivity`,
    attribution:
      '© <a href="https://www.weather.gov" target="_blank" rel="noopener">NWS</a>',
    opacity: 0.9,
    site,
    wmsProduct: 'bref',
  };
}

interface Args {
  map: maplibregl.Map | null;
  styleLoaded: boolean;
  activeProduct: ProductId;
  catalog: RainViewerCatalog | undefined;
  frameIndex: number;
  ts: number;
  /** Override the auto-picked station (user picked a different radar). */
  manualSite?: NexradSite | null;
}

function rainviewerTileUrl(
  productId: ProductId,
  catalog: RainViewerCatalog | undefined,
  frameIndex: number,
): string {
  if (!catalog) return placeholderTileUrl();
  const isSatellite =
    productId === 'satellite-ir' || productId === 'satellite-vis';
  return buildTileUrl({
    catalog,
    kind: isSatellite ? 'satellite' : 'radar',
    frameIndex,
    color: isSatellite ? undefined : 2,
    smooth: 1,
    snow: 1,
  });
}

function bboxFromMap(map: maplibregl.Map) {
  const b = map.getBounds();
  return {
    bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','),
    coords: [
      [b.getWest(), b.getNorth()],
      [b.getEast(), b.getNorth()],
      [b.getEast(), b.getSouth()],
      [b.getWest(), b.getSouth()],
    ] as [
      [number, number],
      [number, number],
      [number, number],
      [number, number],
    ],
  };
}

export function useRadarLayers({
  map,
  styleLoaded,
  activeProduct,
  catalog,
  frameIndex,
  ts,
  manualSite,
}: Args): SourcePlan {
  const overlay = useRadarStore((s) => s.overlayOpacity);
  const mapZoom = useRadarStore((s) => s.mapZoom);
  const mapCenter = useRadarStore((s) => s.mapCenter);
  const lon = mapCenter?.[0] ?? -97;
  const lat = mapCenter?.[1] ?? 39;

  const plan = useMemo<SourcePlan>(() => {
    const auto = pickRadarSource(mapZoom, lon, lat, activeProduct);
    if (manualSite && (auto.kind === 'wms-site')) {
      return { ...auto, site: manualSite, label: `${manualSite.id} · ${auto.wmsProduct === 'bvel' ? 'Base Velocity' : 'Reflectivity'}` };
    }
    return auto;
  }, [mapZoom, lon, lat, activeProduct, manualSite]);

  // RainViewer raster source — radar OR satellite tile depending on
  // active product. Mounted once, tiles swapped via setTiles.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const url = rainviewerTileUrl(activeProduct, catalog, frameIndex);
    const existing = map.getSource(RAINVIEWER_SOURCE) as
      | (maplibregl.RasterTileSource & { setTiles?: (urls: string[]) => void })
      | undefined;
    if (existing && typeof existing.setTiles === 'function') {
      existing.setTiles([url]);
      return;
    }
    if (existing) return;
    map.addSource(RAINVIEWER_SOURCE, {
      type: 'raster',
      tiles: [url],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 12,
    });
    map.addLayer({
      id: RAINVIEWER_LAYER,
      type: 'raster',
      source: RAINVIEWER_SOURCE,
      paint: {
        'raster-opacity': 0,
        'raster-fade-duration': 400,
        'raster-resampling': 'linear',
      },
    });
  }, [map, styleLoaded, activeProduct, catalog, frameIndex]);

  // Iowa State CONUS composite — XYZ tiles. Mounted once, no params
  // change at runtime; opacity does the visibility work.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (map.getSource(IOWA_SOURCE)) return;
    map.addSource(IOWA_SOURCE, {
      type: 'raster',
      tiles: ['/api/radar/iowa-state?z={z}&x={x}&y={y}&product=nexrad-n0q-900913'],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 11,
    });
    map.addLayer({
      id: IOWA_LAYER,
      type: 'raster',
      source: IOWA_SOURCE,
      paint: {
        'raster-opacity': 0,
        'raster-fade-duration': 400,
        'raster-resampling': 'linear',
      },
    });
  }, [map, styleLoaded]);

  // NWS overlay (echo tops, VIL, temperature) — image source whose
  // image refreshes on viewport + product changes.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (plan.kind !== 'nws-overlay' || !plan.nwsService) return;

    const refresh = () => {
      const { bbox, coords } = bboxFromMap(map);
      const url = `/api/radar/nws-overlay?bbox=${encodeURIComponent(
        bbox,
      )}&size=2048,2048&service=${plan.nwsService}&time=${ts * 1000}`;
      const src = map.getSource(NWS_SOURCE) as
        | maplibregl.ImageSource
        | undefined;
      if (src) {
        src.updateImage({ url, coordinates: coords });
        return;
      }
      map.addSource(NWS_SOURCE, { type: 'image', url, coordinates: coords });
      map.addLayer({
        id: NWS_LAYER,
        type: 'raster',
        source: NWS_SOURCE,
        paint: {
          'raster-opacity': 0,
          'raster-fade-duration': 400,
          'raster-resampling': 'linear',
        },
      });
    };

    refresh();
    const handler = () => refresh();
    map.on('moveend', handler);
    return () => {
      map.off('moveend', handler);
    };
  }, [map, styleLoaded, plan.kind, plan.nwsService, ts]);

  // Per-site WMS layer — handled by its own hook so its mount /
  // unmount lifecycle is tied to plan.kind === 'wms-site'.
  useWmsSiteLayer({
    map,
    styleLoaded,
    enabled: plan.kind === 'wms-site',
    site: plan.site ? plan.site.id.toLowerCase() : null,
    product: plan.wmsProduct ?? 'bref',
    opacity: plan.opacity * overlay,
  });

  // Crossfade — set every layer's opacity each time the plan changes.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const isRain =
      plan.kind === 'rainviewer-radar' || plan.kind === 'rainviewer-satellite';
    fadeRasterTo(map, RAINVIEWER_LAYER, isRain ? plan.opacity * overlay : 0);
    fadeRasterTo(map, IOWA_LAYER, plan.kind === 'iowa' ? plan.opacity * overlay : 0);
    fadeRasterTo(map, NWS_LAYER, plan.kind === 'nws-overlay' ? plan.opacity * overlay : 0);
  }, [map, styleLoaded, plan, overlay]);

  return plan;
}
