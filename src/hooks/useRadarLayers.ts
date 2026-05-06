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
export const L2_SOURCE = 'level2-overlay';
export const L2_LAYER = 'level2-layer';

export type SourceKind =
  | 'rainviewer-radar'
  | 'rainviewer-satellite'
  | 'iowa'
  | 'wms-site'
  | 'level2'
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
  /** Set when kind === 'wms-site' or 'level2'. */
  site?: NexradSite;
  /** Per-site WMS product when applicable. */
  wmsProduct?: 'bref' | 'bvel';
  /** Level 2 product (reflectivity / velocity). */
  l2Product?: 'reflectivity' | 'velocity';
  /** NWS mapservices ImageServer name (for echo tops / VIL). */
  nwsService?: string;
}

export function pickRadarSource(
  zoom: number,
  lon: number,
  lat: number,
  productId: ProductId,
): SourcePlan {
  // Velocity products: per-site WMS bvel below z12, raw L2 velocity
  // above. L2 gives full 250m gates of Doppler — far better than the
  // RIDGE WMS at storm-scale zoom.
  if (productId === 'velocity' || productId === 'storm-rel-velocity') {
    const site = nearestNexradSite(lon, lat);
    if (zoom >= 12) {
      return {
        kind: 'level2',
        label: `${site.id} · Base Velocity (L2)`,
        attribution:
          '© <a href="https://www.weather.gov" target="_blank" rel="noopener">NWS NEXRAD Level 2</a>',
        opacity: 0.92,
        site,
        l2Product: 'velocity',
      };
    }
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
  if (zoom >= 12) {
    return {
      kind: 'level2',
      label: `${site.id} · Reflectivity (L2)`,
      attribution:
        '© <a href="https://www.weather.gov" target="_blank" rel="noopener">NWS NEXRAD Level 2</a>',
      opacity: 0.92,
      site,
      l2Product: 'reflectivity',
    };
  }
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
  /** YYYYMMDDHHMM string for Iowa State historical frame (omit for live). */
  iowaTs?: string | null;
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
  iowaTs,
  manualSite,
}: Args): SourcePlan {
  const overlay = useRadarStore((s) => s.overlayOpacity);
  const mapZoom = useRadarStore((s) => s.mapZoom);
  const mapCenter = useRadarStore((s) => s.mapCenter);
  const lon = mapCenter?.[0] ?? -97;
  const lat = mapCenter?.[1] ?? 39;

  const plan = useMemo<SourcePlan>(() => {
    const auto = pickRadarSource(mapZoom, lon, lat, activeProduct);
    if (manualSite && auto.kind === 'wms-site') {
      return {
        ...auto,
        site: manualSite,
        label: `${manualSite.id} · ${
          auto.wmsProduct === 'bvel' ? 'Base Velocity' : 'Reflectivity'
        }`,
      };
    }
    if (manualSite && auto.kind === 'level2') {
      return {
        ...auto,
        site: manualSite,
        label: `${manualSite.id} · ${
          auto.l2Product === 'velocity' ? 'Base Velocity (L2)' : 'Reflectivity (L2)'
        }`,
      };
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

  // Iowa State CONUS composite — XYZ tiles. Re-registered when iowaTs
  // changes so the scrubber actually advances historical frames.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const tilesUrl = iowaTs
      ? `/api/radar/iowa-state?z={z}&x={x}&y={y}&product=nexrad-n0q-900913&ts=${iowaTs}`
      : `/api/radar/iowa-state?z={z}&x={x}&y={y}&product=nexrad-n0q-900913`;

    const existing = map.getSource(IOWA_SOURCE) as
      | (maplibregl.RasterTileSource & { setTiles?: (urls: string[]) => void })
      | undefined;
    if (existing && typeof existing.setTiles === 'function') {
      existing.setTiles([tilesUrl]);
      return;
    }
    if (existing) return;
    map.addSource(IOWA_SOURCE, {
      type: 'raster',
      tiles: [tilesUrl],
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
  }, [map, styleLoaded, iowaTs]);

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

  // NEXRAD Level 2 image source. Active at zoom ≥ 12 over the nearest
  // station. Endpoint returns { url, bbox }; we mount an image source
  // anchored at that bbox and refresh every 5 minutes.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (plan.kind !== 'level2' || !plan.site) {
      // Tear down when leaving L2 mode so the next mount fetches fresh.
      if (map.getLayer(L2_LAYER)) map.removeLayer(L2_LAYER);
      if (map.getSource(L2_SOURCE)) map.removeSource(L2_SOURCE);
      return;
    }

    const siteId = plan.site.id;
    const product = plan.l2Product ?? 'reflectivity';
    let cancelled = false;
    let interval: number | undefined;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/radar/level2?site=${siteId}&product=${product}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          url: string;
          bbox: [number, number, number, number];
        };
        if (cancelled || !map) return;

        const [w, s, e, n] = data.bbox;
        const coords: [
          [number, number],
          [number, number],
          [number, number],
          [number, number],
        ] = [
          [w, n],
          [e, n],
          [e, s],
          [w, s],
        ];

        const existing = map.getSource(L2_SOURCE) as
          | maplibregl.ImageSource
          | undefined;
        if (existing) {
          existing.updateImage({ url: data.url, coordinates: coords });
          return;
        }
        map.addSource(L2_SOURCE, {
          type: 'image',
          url: data.url,
          coordinates: coords,
        });
        map.addLayer({
          id: L2_LAYER,
          type: 'raster',
          source: L2_SOURCE,
          paint: {
            'raster-opacity': 0,
            'raster-fade-duration': 400,
            'raster-resampling': 'linear',
          },
        });
      } catch {
        // L2 failures are non-fatal — RIDGE is still available below.
      }
    };

    load();
    interval = window.setInterval(load, 5 * 60_000);

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [map, styleLoaded, plan.kind, plan.site?.id, plan.l2Product]);

  // Crossfade — set every layer's opacity each time the plan changes.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const isRain =
      plan.kind === 'rainviewer-radar' || plan.kind === 'rainviewer-satellite';
    fadeRasterTo(map, RAINVIEWER_LAYER, isRain ? plan.opacity * overlay : 0);
    fadeRasterTo(map, IOWA_LAYER, plan.kind === 'iowa' ? plan.opacity * overlay : 0);
    fadeRasterTo(map, NWS_LAYER, plan.kind === 'nws-overlay' ? plan.opacity * overlay : 0);
    fadeRasterTo(map, L2_LAYER, plan.kind === 'level2' ? plan.opacity * overlay : 0);
  }, [map, styleLoaded, plan, overlay]);

  return plan;
}
