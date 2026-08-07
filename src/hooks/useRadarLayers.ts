// Layer orchestration for the radar map. Each frame the resolver picks
// the right upstream service for the active product × zoom × region;
// this hook mounts the corresponding MapLibre source on demand and
// crossfades all the others to opacity 0.

import maplibregl from 'maplibre-gl';
import { useEffect, useMemo, useState } from 'react';
import { fadeRasterTo } from '../lib/crossfade';
import { type ProductId } from '../constants/products';
import {
  buildTileUrl,
  pickFrameIndex,
  placeholderTileUrl,
  type RainViewerCatalog,
} from '../lib/rainviewer';
import {
  nearestNexradSite,
  type NexradSite,
} from '../lib/nexradSites';
import { useRadarStore } from '../store/useRadarStore';
import { useWmsSiteLayer } from './useWmsSiteLayer';
import { detectRegion } from '../lib/regionDetect';
import {
  resolveSource,
  unavailabilityReason,
  type SourceChoice,
  type SourceKind,
} from '../lib/sourceResolver';
import { metersBboxFromLngLat } from '../lib/mercator';

export const RAINVIEWER_SOURCE = 'rainviewer-radar';
export const RAINVIEWER_LAYER = 'rainviewer-radar-layer';
export const RAINVIEWER_RADAR_SOURCE = 'rainviewer-radar';
export const RAINVIEWER_RADAR_LAYER = 'rainviewer-radar-layer';
export const RAINVIEWER_SAT_SOURCE = 'rainviewer-satellite';
export const RAINVIEWER_SAT_LAYER = 'rainviewer-satellite-layer';
export const IOWA_SOURCE = 'iowa-tiles';
export const IOWA_LAYER = 'iowa-layer';
export const NWS_SOURCE = 'nws-overlay';
export const NWS_LAYER = 'nws-overlay-layer';
export const L2_SOURCE = 'level2-overlay';
export const L2_LAYER = 'level2-layer';
export const L3_SOURCE = 'level3-overlay';
export const L3_LAYER = 'level3-layer';
export const DWD_SOURCE = 'dwd-overlay';
export const DWD_LAYER = 'dwd-overlay-layer';
export const GIBS_SOURCE = 'gibs-tiles';
export const GIBS_LAYER = 'gibs-layer';
export const IOWA_GOES_SOURCE = 'iowa-goes-tiles';
export const IOWA_GOES_LAYER = 'iowa-goes-layer';
export const GRID_SOURCE = 'open-meteo-grid';
export const GRID_LAYER = 'open-meteo-grid-layer';

/** @deprecated Alias kept for imports that still use the old name. */
export const GIBS_IR_SOURCE = GIBS_SOURCE;
export const GIBS_IR_LAYER = GIBS_LAYER;
export const IOWA_GOES_VIS_SOURCE = IOWA_GOES_SOURCE;
export const IOWA_GOES_VIS_LAYER = IOWA_GOES_LAYER;

export interface SourcePlan {
  kind: SourceKind | 'unavailable';
  label: string;
  attribution: string;
  opacity: number;
  site?: NexradSite;
  unavailableReason?: string | null;
}

interface Args {
  map: maplibregl.Map | null;
  styleLoaded: boolean;
  activeProduct: ProductId;
  catalog: RainViewerCatalog | undefined;
  frameIndex: number;
  ts: number;
  iowaTs?: string | null;
  manualSite?: NexradSite | null;
}

const PIXELATED_PAINT: maplibregl.RasterLayerSpecification['paint'] = {
  'raster-opacity': 0,
  'raster-fade-duration': 0,
  'raster-resampling': 'nearest',
};

function safeAdd(
  map: maplibregl.Map,
  styleLoaded: boolean,
  fn: () => void,
): void {
  if (!styleLoaded) return;
  if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
    map.once('idle', fn);
    return;
  }
  fn();
}

function radarTileUrl(
  catalog: RainViewerCatalog | undefined,
  ts: number,
): string {
  if (!catalog || catalog.radarPast.length + catalog.radarNowcast.length === 0) {
    return placeholderTileUrl();
  }
  const idx = pickFrameIndex(catalog, 'radar', ts);
  return buildTileUrl({
    catalog,
    kind: 'radar',
    frameIndex: idx,
    color: 7,
    smooth: 0,
    snow: 1,
  });
}

function satelliteTileUrl(
  catalog: RainViewerCatalog | undefined,
  ts: number,
): string {
  if (!catalog || catalog.satelliteInfrared.length === 0) {
    return placeholderTileUrl();
  }
  const idx = pickFrameIndex(catalog, 'satellite', ts);
  return buildTileUrl({
    catalog,
    kind: 'satellite',
    frameIndex: idx,
    color: 0,
    smooth: 0,
    snow: 0,
  });
}

function bboxFromMap(map: maplibregl.Map) {
  const b = map.getBounds();
  return {
    bbox4326: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','),
    bbox3857: metersBboxFromLngLat(
      b.getWest(),
      b.getSouth(),
      b.getEast(),
      b.getNorth(),
    ),
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

/** GIBS REST WMTS — IR tops out at Level6; VIS at Level7. */
function gibsTileUrl(layerName: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const isVis = /Visible|Band2/i.test(layerName);
  const ext = isVis ? 'jpg' : 'png';
  const matrix = isVis
    ? 'GoogleMapsCompatible_Level7'
    : 'GoogleMapsCompatible_Level6';
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/` +
    `${layerName}/default/${day}/${matrix}/{z}/{y}/{x}.${ext}`
  );
}

function attributionFor(kind: SourceKind): string {
  switch (kind) {
    case 'iowa-state':
    case 'iowa-goes':
      return '© <a href="https://mesonet.agron.iastate.edu" target="_blank" rel="noopener">Iowa State Mesonet</a>';
    case 'rainviewer':
      return '© <a href="https://rainviewer.com" target="_blank" rel="noopener">RainViewer</a>';
    case 'ridge-wms':
      return '© <a href="https://www.weather.gov" target="_blank" rel="noopener">NWS</a>';
    case 'level2':
      return '© <a href="https://www.weather.gov" target="_blank" rel="noopener">NWS NEXRAD Level 2</a>';
    case 'level3':
      return '© <a href="https://www.weather.gov" target="_blank" rel="noopener">NWS NEXRAD Level 3</a> · Unidata';
    case 'dwd':
      return '© <a href="https://www.dwd.de" target="_blank" rel="noopener">DWD</a>';
    case 'gibs':
      return '© <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a> · GOES ABI';
    case 'open-meteo-grid':
      return '© <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>';
    case 'windy':
      return '© <a href="https://windy.com" target="_blank" rel="noopener">Windy</a>';
  }
}

function labelFor(
  kind: SourceKind,
  product: string,
  productId: ProductId,
  site: NexradSite | undefined,
): string {
  if (kind === 'iowa-state') return 'NEXRAD Composite (Iowa State)';
  if (kind === 'rainviewer') {
    return product === 'satellite' || productId.startsWith('satellite')
      ? 'Satellite (RainViewer)'
      : 'Reflectivity (RainViewer)';
  }
  if (kind === 'ridge-wms') {
    if (product === 'cref') return 'CONUS Composite (NWS)';
    if (site) {
      return `${site.id} · ${product === 'bvel' ? 'Base Velocity' : 'Reflectivity'}`;
    }
    return 'NWS Radar';
  }
  if (kind === 'level2' && site) {
    const label =
      product === 'velocity'
        ? 'Base Velocity (L2)'
        : product === 'correlation'
          ? 'Correlation Coef (L2)'
          : 'Reflectivity (L2)';
    return `${site.id} · ${label}`;
  }
  if (kind === 'level3' && site) {
    return product === 'ROT'
      ? `${site.id} · Rotation (L3)`
      : `${site.id} · Storm-Rel Vel (L3)`;
  }
  if (kind === 'dwd') return 'DWD Niederschlagsradar';
  if (kind === 'gibs') {
    return /West/i.test(product)
      ? 'GOES-West · GIBS'
      : 'GOES-East · GIBS';
  }
  if (kind === 'iowa-goes') {
    return /west/i.test(product)
      ? 'GOES-West · Visible (Iowa)'
      : 'GOES-East · Visible (Iowa)';
  }
  if (kind === 'open-meteo-grid') {
    return productId === 'wind'
      ? 'Wind (Open-Meteo, forecast)'
      : 'Temperature (Open-Meteo, forecast)';
  }
  return 'Reflectivity';
}

export function useRadarLayers({
  map,
  styleLoaded,
  activeProduct,
  catalog,
  ts,
  iowaTs,
  manualSite,
}: Args): SourcePlan {
  const overlay = useRadarStore((s) => s.overlayOpacity);
  const mapZoom = useRadarStore((s) => s.mapZoom);
  const mapCenter = useRadarStore((s) => s.mapCenter);
  const lon = mapCenter?.[0] ?? -97;
  const lat = mapCenter?.[1] ?? 39;
  const [activeKind, setActiveKind] = useState<SourceKind | null>(null);

  const region = useMemo(() => detectRegion(lon, lat), [lon, lat]);

  const choice: SourceChoice = useMemo(
    () => resolveSource(activeProduct, mapZoom, region, lon),
    [activeProduct, mapZoom, region, lon],
  );

  // Apply fallback when primary reports failure via activeKind override.
  const effectiveChoice = useMemo<SourceChoice>(() => {
    if (
      activeKind &&
      choice.fallback &&
      activeKind === choice.fallback &&
      choice.kind !== activeKind
    ) {
      return { ...choice, kind: choice.fallback, fallback: undefined };
    }
    return choice;
  }, [choice, activeKind]);

  useEffect(() => {
    setActiveKind(null);
  }, [choice.kind, choice.product, activeProduct]);

  const reason = useMemo(
    () => unavailabilityReason(activeProduct, mapZoom, region),
    [activeProduct, mapZoom, region],
  );

  const site = useMemo<NexradSite | undefined>(() => {
    if (
      effectiveChoice.kind !== 'ridge-wms' &&
      effectiveChoice.kind !== 'level2' &&
      effectiveChoice.kind !== 'level3'
    ) {
      return undefined;
    }
    if (effectiveChoice.product === 'cref') return undefined;
    return manualSite ?? nearestNexradSite(lon, lat);
  }, [effectiveChoice.kind, effectiveChoice.product, manualSite, lon, lat]);

  const isSatelliteProduct =
    activeProduct === 'satellite-ir' || activeProduct === 'satellite-vis';
  const hasRainviewerSat = (catalog?.satelliteInfrared.length ?? 0) > 0;

  const plan = useMemo<SourcePlan>(() => {
    return {
      kind: effectiveChoice.opacity === 0 ? 'unavailable' : effectiveChoice.kind,
      label: labelFor(
        effectiveChoice.kind,
        effectiveChoice.product,
        activeProduct,
        site,
      ),
      attribution: attributionFor(effectiveChoice.kind),
      opacity: effectiveChoice.opacity,
      site,
      unavailableReason: reason,
    };
  }, [effectiveChoice, site, activeProduct, reason]);

  // RainViewer radar
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const url = radarTileUrl(catalog, ts);
    const existing = map.getSource(RAINVIEWER_RADAR_SOURCE) as
      | (maplibregl.RasterTileSource & { setTiles?: (urls: string[]) => void })
      | undefined;
    if (existing && typeof existing.setTiles === 'function') {
      existing.setTiles([url]);
      return;
    }
    if (existing) return;
    safeAdd(map, styleLoaded, () => {
      if (map.getSource(RAINVIEWER_RADAR_SOURCE)) return;
      map.addSource(RAINVIEWER_RADAR_SOURCE, {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 12,
      });
      map.addLayer({
        id: RAINVIEWER_RADAR_LAYER,
        type: 'raster',
        source: RAINVIEWER_RADAR_SOURCE,
        paint: PIXELATED_PAINT,
      });
    });
  }, [map, styleLoaded, catalog, ts]);

  // RainViewer satellite IR
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const url = satelliteTileUrl(catalog, ts);
    const existing = map.getSource(RAINVIEWER_SAT_SOURCE) as
      | (maplibregl.RasterTileSource & { setTiles?: (urls: string[]) => void })
      | undefined;
    if (existing && typeof existing.setTiles === 'function') {
      existing.setTiles([url]);
      return;
    }
    if (existing) return;
    safeAdd(map, styleLoaded, () => {
      if (map.getSource(RAINVIEWER_SAT_SOURCE)) return;
      map.addSource(RAINVIEWER_SAT_SOURCE, {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 9,
      });
      map.addLayer({
        id: RAINVIEWER_SAT_LAYER,
        type: 'raster',
        source: RAINVIEWER_SAT_SOURCE,
        paint: PIXELATED_PAINT,
      });
    });
  }, [map, styleLoaded, catalog, ts]);

  // Iowa State XYZ
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const product =
      effectiveChoice.kind === 'iowa-state'
        ? effectiveChoice.product
        : 'nexrad-n0q-900913';
    const tilesUrl = iowaTs
      ? `/api/radar/iowa-state?z={z}&x={x}&y={y}&product=${product}&ts=${iowaTs}`
      : `/api/radar/iowa-state?z={z}&x={x}&y={y}&product=${product}`;

    const existing = map.getSource(IOWA_SOURCE) as
      | (maplibregl.RasterTileSource & { setTiles?: (urls: string[]) => void })
      | undefined;
    if (existing && typeof existing.setTiles === 'function') {
      existing.setTiles([tilesUrl]);
      return;
    }
    if (existing) return;
    safeAdd(map, styleLoaded, () => {
      if (map.getSource(IOWA_SOURCE)) return;
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
        paint: PIXELATED_PAINT,
      });
    });
  }, [map, styleLoaded, iowaTs, effectiveChoice.kind, effectiveChoice.product]);

  // Open-Meteo grid
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (effectiveChoice.kind !== 'open-meteo-grid') return;
    const url = `/api/weather/grid?z={z}&x={x}&y={y}&layer=${effectiveChoice.product}`;

    const existing = map.getSource(GRID_SOURCE) as
      | (maplibregl.RasterTileSource & { setTiles?: (urls: string[]) => void })
      | undefined;
    if (existing && typeof existing.setTiles === 'function') {
      existing.setTiles([url]);
      return;
    }
    if (existing) return;
    safeAdd(map, styleLoaded, () => {
      if (map.getSource(GRID_SOURCE)) return;
      map.addSource(GRID_SOURCE, {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 12,
      });
      map.addLayer({
        id: GRID_LAYER,
        type: 'raster',
        source: GRID_SOURCE,
        paint: PIXELATED_PAINT,
      });
    });
  }, [map, styleLoaded, effectiveChoice.kind, effectiveChoice.product]);

  // DWD
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (effectiveChoice.kind !== 'dwd') {
      if (map.getLayer(DWD_LAYER)) map.removeLayer(DWD_LAYER);
      if (map.getSource(DWD_SOURCE)) map.removeSource(DWD_SOURCE);
      return;
    }

    let timer: number | undefined;

    const refresh = () => {
      const { bbox3857, coords } = bboxFromMap(map);
      const url = `/api/radar/dwd?bbox=${encodeURIComponent(
        bbox3857,
      )}&width=1024&height=1024`;
      const src = map.getSource(DWD_SOURCE) as
        | maplibregl.ImageSource
        | undefined;
      if (src) {
        src.updateImage({ url, coordinates: coords });
        return;
      }
      safeAdd(map, styleLoaded, () => {
        if (map.getSource(DWD_SOURCE)) return;
        map.addSource(DWD_SOURCE, { type: 'image', url, coordinates: coords });
        map.addLayer({
          id: DWD_LAYER,
          type: 'raster',
          source: DWD_SOURCE,
          paint: PIXELATED_PAINT,
        });
      });
    };

    const debounced = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(refresh, 300);
    };

    refresh();
    map.on('moveend', debounced);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      map.off('moveend', debounced);
    };
  }, [map, styleLoaded, effectiveChoice.kind, ts]);

  // NASA GIBS
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (effectiveChoice.kind !== 'gibs') {
      if (map.getLayer(GIBS_LAYER)) map.removeLayer(GIBS_LAYER);
      if (map.getSource(GIBS_SOURCE)) map.removeSource(GIBS_SOURCE);
      return;
    }
    const url = gibsTileUrl(effectiveChoice.product);
    const isVis = /Visible|Band2/i.test(effectiveChoice.product);
    const maxzoom = isVis ? 7 : 6;

    // Remount when IR↔VIS changes (different matrix set / maxzoom).
    if (map.getLayer(GIBS_LAYER)) map.removeLayer(GIBS_LAYER);
    if (map.getSource(GIBS_SOURCE)) map.removeSource(GIBS_SOURCE);

    safeAdd(map, styleLoaded, () => {
      if (map.getSource(GIBS_SOURCE)) return;
      map.addSource(GIBS_SOURCE, {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        minzoom: 0,
        maxzoom,
      });
      map.addLayer({
        id: GIBS_LAYER,
        type: 'raster',
        source: GIBS_SOURCE,
        paint: PIXELATED_PAINT,
      });
    });
  }, [map, styleLoaded, effectiveChoice.kind, effectiveChoice.product]);

  // Iowa GOES (vis / ir)
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const product =
      effectiveChoice.kind === 'iowa-goes'
        ? effectiveChoice.product
        : 'goes-east-vis-1km-900913';
    const url = `/api/radar/iowa-state?z={z}&x={x}&y={y}&product=${product}`;
    const existing = map.getSource(IOWA_GOES_SOURCE) as
      | (maplibregl.RasterTileSource & { setTiles?: (urls: string[]) => void })
      | undefined;
    if (existing && typeof existing.setTiles === 'function') {
      existing.setTiles([url]);
      return;
    }
    if (existing) return;
    safeAdd(map, styleLoaded, () => {
      if (map.getSource(IOWA_GOES_SOURCE)) return;
      map.addSource(IOWA_GOES_SOURCE, {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 10,
      });
      map.addLayer({
        id: IOWA_GOES_LAYER,
        type: 'raster',
        source: IOWA_GOES_SOURCE,
        paint: PIXELATED_PAINT,
      });
    });
  }, [map, styleLoaded, effectiveChoice.kind, effectiveChoice.product]);

  // Per-site / CONUS WMS
  const wmsProduct =
    effectiveChoice.product === 'bvel'
      ? 'bvel'
      : effectiveChoice.product === 'cref'
        ? 'cref'
        : 'bref';
  const wmsSite =
    effectiveChoice.product === 'cref'
      ? 'conus'
      : site
        ? site.id.toLowerCase()
        : null;

  useWmsSiteLayer({
    map,
    styleLoaded,
    enabled: effectiveChoice.kind === 'ridge-wms',
    site: wmsSite,
    product: wmsProduct,
    opacity: effectiveChoice.opacity * overlay,
  });

  // Level 2
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (effectiveChoice.kind !== 'level2' || !site) {
      if (map.getLayer(L2_LAYER)) map.removeLayer(L2_LAYER);
      if (map.getSource(L2_SOURCE)) map.removeSource(L2_SOURCE);
      return;
    }

    const siteId = site.id;
    const product = effectiveChoice.product;
    let cancelled = false;
    let interval: number | undefined;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/radar/level2?site=${siteId}&product=${product}`,
        );
        if (!res.ok) {
          if (choice.fallback) setActiveKind(choice.fallback);
          return;
        }
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
        safeAdd(map, styleLoaded, () => {
          if (map.getSource(L2_SOURCE)) return;
          map.addSource(L2_SOURCE, {
            type: 'image',
            url: data.url,
            coordinates: coords,
          });
          map.addLayer({
            id: L2_LAYER,
            type: 'raster',
            source: L2_SOURCE,
            paint: PIXELATED_PAINT,
          });
        });
      } catch {
        if (choice.fallback) setActiveKind(choice.fallback);
      }
    };

    load();
    interval = window.setInterval(load, 5 * 60_000);

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [
    map,
    styleLoaded,
    effectiveChoice.kind,
    effectiveChoice.product,
    site?.id,
    choice.fallback,
  ]);

  // Level 3 (N0S / ROT)
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (effectiveChoice.kind !== 'level3' || !site) {
      if (map.getLayer(L3_LAYER)) map.removeLayer(L3_LAYER);
      if (map.getSource(L3_SOURCE)) map.removeSource(L3_SOURCE);
      return;
    }

    const siteId = site.id;
    const product = effectiveChoice.product;
    let cancelled = false;
    let interval: number | undefined;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/radar/level3?site=${siteId}&product=${product}`,
        );
        if (!res.ok) return;
        const ct = res.headers.get('content-type') ?? '';
        let url: string;
        let bbox: [number, number, number, number];
        if (ct.includes('application/json')) {
          const data = (await res.json()) as {
            url: string;
            bbox: [number, number, number, number];
          };
          url = data.url;
          bbox = data.bbox;
        } else {
          const blob = await res.blob();
          url = URL.createObjectURL(blob);
          const hdr = res.headers.get('X-Bbox');
          if (hdr) {
            const parts = hdr.split(',').map(Number);
            bbox = [parts[0], parts[1], parts[2], parts[3]];
          } else {
            bbox = [
              site.lon - 2.5,
              site.lat - 2.5,
              site.lon + 2.5,
              site.lat + 2.5,
            ];
          }
        }
        if (cancelled || !map) return;

        const [w, s, e, n] = bbox;
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

        const existing = map.getSource(L3_SOURCE) as
          | maplibregl.ImageSource
          | undefined;
        if (existing) {
          existing.updateImage({ url, coordinates: coords });
          return;
        }
        safeAdd(map, styleLoaded, () => {
          if (map.getSource(L3_SOURCE)) return;
          map.addSource(L3_SOURCE, {
            type: 'image',
            url,
            coordinates: coords,
          });
          map.addLayer({
            id: L3_LAYER,
            type: 'raster',
            source: L3_SOURCE,
            paint: PIXELATED_PAINT,
          });
        });
      } catch {
        // Non-fatal — banner still shows US-only context.
      }
    };

    load();
    interval = window.setInterval(load, 5 * 60_000);

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [
    map,
    styleLoaded,
    effectiveChoice.kind,
    effectiveChoice.product,
    site?.id,
    site?.lat,
    site?.lon,
  ]);

  // Crossfade
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const target = effectiveChoice.opacity * overlay;
    const kind = effectiveChoice.kind;

    const showRvRadar = kind === 'rainviewer' && !isSatelliteProduct;
    const showRvSat =
      kind === 'rainviewer' && isSatelliteProduct && hasRainviewerSat;

    fadeRasterTo(map, RAINVIEWER_RADAR_LAYER, showRvRadar ? target : 0);
    fadeRasterTo(map, RAINVIEWER_SAT_LAYER, showRvSat ? target : 0);
    fadeRasterTo(map, IOWA_LAYER, kind === 'iowa-state' ? target : 0);
    fadeRasterTo(map, L2_LAYER, kind === 'level2' ? target : 0);
    fadeRasterTo(map, L3_LAYER, kind === 'level3' ? target : 0);
    fadeRasterTo(map, DWD_LAYER, kind === 'dwd' ? target : 0);
    fadeRasterTo(map, GIBS_LAYER, kind === 'gibs' ? target : 0);
    fadeRasterTo(map, IOWA_GOES_LAYER, kind === 'iowa-goes' ? target : 0);
    fadeRasterTo(map, GRID_LAYER, kind === 'open-meteo-grid' ? target : 0);
    fadeRasterTo(map, NWS_LAYER, 0);
  }, [
    map,
    styleLoaded,
    effectiveChoice,
    overlay,
    isSatelliteProduct,
    hasRainviewerSat,
  ]);

  return plan;
}
