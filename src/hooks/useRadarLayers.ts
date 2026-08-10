// Layer orchestration for the radar map. Each frame the resolver picks
// the right upstream service for the active product × zoom × region;
// this hook mounts the corresponding MapLibre source on demand and
// crossfades all the others to opacity 0.

import maplibregl from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useWmsSiteLayer, WMS_LAYER_ID, WMS_SOURCE_ID } from './useWmsSiteLayer';
import { detectRegionForViewport } from '../lib/regionDetect';
import {
  createRetiringUrlSlot,
  putImageLayer,
  removeImageLayer,
  type ImageCorners,
} from '../lib/imageLayer';
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
export const MOSAIC_SOURCE = 'radar-mosaic';
export const MOSAIC_LAYER = 'radar-mosaic-layer';

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
  /** ISO8601 for OpenGeo WMS TIME (scrubber). */
  wmsTime?: string | null;
  manualSite?: NexradSite | null;
}

const PIXELATED_PAINT: maplibregl.RasterLayerSpecification['paint'] = {
  'raster-opacity': 0,
  'raster-fade-duration': 0,
  'raster-resampling': 'nearest',
};

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
    ] as ImageCorners,
  };
}

/** GIBS REST WMTS. IR max Level6; VIS max Level7. Prefer dated path. */
function gibsTileUrl(layerName: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const isVis = /Visible|Band2/i.test(layerName);
  const ext = isVis ? 'jpg' : 'png';
  const matrix = isVis
    ? 'GoogleMapsCompatible_Level7'
    : 'GoogleMapsCompatible_Level6';
  // Dated path; GIBS also accepts the literal "default" time for NRT.
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/` +
    `${layerName}/default/${day}/${matrix}/{z}/{y}/{x}.${ext}`
  );
}

function setRasterOpacity(
  map: maplibregl.Map,
  layerId: string,
  opacity: number,
): void {
  if (!map.getLayer(layerId)) return;
  map.setPaintProperty(
    layerId,
    'raster-opacity',
    Math.max(0, Math.min(1, opacity)),
  );
}

/**
 * Mount a raster tile source once, then only swap tiles and opacity.
 *
 * Callers must already have checked `styleLoaded`, which is set from
 * MapLibre's `load` event — at that point the style is parsed and
 * addSource/addLayer are safe. Deferring to `map.once('idle', …)` is not:
 * `idle` waits for every mounted source to settle, and this map keeps
 * several tile sources fetching continuously.
 */
function ensureRasterSource(
  map: maplibregl.Map,
  sourceId: string,
  layerId: string,
  tilesUrl: string,
  opts: {
    minzoom?: number;
    maxzoom?: number;
    opacity?: number;
    /** Default nearest (radar). Use linear for continuous fields like wind/temp. */
    resampling?: 'nearest' | 'linear';
  } = {},
): void {
  const {
    minzoom = 0,
    maxzoom = 12,
    opacity = 0,
    resampling = 'nearest',
  } = opts;
  const existing = map.getSource(sourceId) as
    | (maplibregl.RasterTileSource & { setTiles?: (urls: string[]) => void })
    | undefined;
  if (existing) {
    if (typeof existing.setTiles === 'function') existing.setTiles([tilesUrl]);
  } else {
    map.addSource(sourceId, {
      type: 'raster',
      tiles: [tilesUrl],
      tileSize: 256,
      minzoom,
      maxzoom,
    });
  }
  if (map.getLayer(layerId)) {
    setRasterOpacity(map, layerId, opacity);
    if (map.getPaintProperty(layerId, 'raster-resampling') !== resampling) {
      map.setPaintProperty(layerId, 'raster-resampling', resampling);
    }
    return;
  }
  map.addLayer({
    id: layerId,
    type: 'raster',
    source: sourceId,
    paint: {
      'raster-opacity': Math.max(0, Math.min(1, opacity)),
      'raster-fade-duration': resampling === 'linear' ? 200 : 0,
      'raster-resampling': resampling,
    },
  });
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
    case 'mosaic':
      return '© <a href="https://www.weather.gov" target="_blank" rel="noopener">NWS NEXRAD</a> · multi-site mosaic';
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
    if (product === 'conus-bref') return 'CONUS Base Reflectivity (NWS)';
    if (product === 'neet') return 'Echo Tops (MRMS)';
    if (product === 'pcpn') return 'Precipitation Type (MRMS)';
    if (product === 'bdhc' && site) return `${site.id} · Hydrometeor Class`;
    if (product === 'boha' && site) return `${site.id} · 1-Hour Rainfall`;
    if (product === 'bdsa' && site) return `${site.id} · Storm Total`;
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
      : product === 'N0C'
        ? `${site.id} · Correlation (L3)`
        : `${site.id} · Storm-Rel Vel (L3)`;
  }
  if (kind === 'mosaic') {
    if (product === 'bvel') return 'Base Velocity (CONUS mosaic)';
    if (product === 'rot') return 'Rotation (CONUS mosaic)';
    if (product === 'n0c') return 'Correlation (CONUS mosaic)';
    if (product === 'n0s') return 'Storm-Rel Velocity (CONUS mosaic)';
    return 'Radar mosaic';
  }
  if (kind === 'dwd') return 'DWD Niederschlagsradar';
  if (kind === 'gibs') {
    return /West/i.test(product)
      ? 'GOES-West · GIBS'
      : 'GOES-East · GIBS';
  }
  if (kind === 'iowa-goes') {
    const west = /west/i.test(product);
    const ir = /ir-/i.test(product) || /Infrared/i.test(product);
    const sector = west ? 'GOES-West' : 'GOES-East';
    return ir
      ? `${sector} · Infrared (Iowa)`
      : `${sector} · Visible (Iowa)`;
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
  wmsTime,
  manualSite,
}: Args): SourcePlan {
  const overlay = useRadarStore((s) => s.overlayOpacity);
  const mapZoom = useRadarStore((s) => s.mapZoom);
  const mapCenter = useRadarStore((s) => s.mapCenter);
  const bbox = useRadarStore((s) => s.bbox);
  const setLayerLoading = useRadarStore((s) => s.setLayerLoading);
  const lon = mapCenter?.[0] ?? -97;
  const lat = mapCenter?.[1] ?? 39;
  const [activeKind, setActiveKind] = useState<SourceKind | null>(null);
  const [wmsFailReason, setWmsFailReason] = useState<string | null>(null);

  // Classify from the whole viewport, not just the centre: at continental
  // zoom the centre drifts into Canada or the Gulf while CONUS fills the
  // screen, which reported US-only products as unavailable.
  const region = useMemo(
    () => detectRegionForViewport(lon, lat, bbox),
    [lon, lat, bbox],
  );

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
    setWmsFailReason(null);
  }, [choice.kind, choice.product, activeProduct]);

  const reason = useMemo(() => {
    const base = unavailabilityReason(activeProduct, mapZoom, region);
    if (base) return base;
    if (wmsFailReason && effectiveChoice.kind === 'ridge-wms' && !choice.fallback) {
      return `Layer temporarily unavailable (${wmsFailReason}).`;
    }
    return null;
  }, [
    activeProduct,
    mapZoom,
    region,
    wmsFailReason,
    effectiveChoice.kind,
    choice.fallback,
  ]);

  const site = useMemo<NexradSite | undefined>(() => {
    if (
      effectiveChoice.kind !== 'ridge-wms' &&
      effectiveChoice.kind !== 'level2' &&
      effectiveChoice.kind !== 'level3'
    ) {
      return undefined;
    }
    if (
      effectiveChoice.product === 'cref' ||
      effectiveChoice.product === 'conus-bref' ||
      effectiveChoice.product === 'neet' ||
      effectiveChoice.product === 'pcpn'
    ) {
      return undefined;
    }
    return manualSite ?? nearestNexradSite(lon, lat);
  }, [effectiveChoice.kind, effectiveChoice.product, manualSite, lon, lat]);

  const isSatelliteProduct =
    activeProduct === 'satellite-ir' || activeProduct === 'satellite-vis';
  const hasRainviewerSat = (catalog?.satelliteInfrared.length ?? 0) > 0;

  // Image layers mount from async callbacks, so they must read the live
  // target rather than whatever `overlay` was when the effect was set up.
  const targetOpacity = effectiveChoice.opacity * overlay;
  const targetOpacityRef = useRef(targetOpacity);
  targetOpacityRef.current = targetOpacity;

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
  }, [map, styleLoaded, catalog, ts]);

  // Iowa State XYZ (reflectivity composite) — May 5 primary CONUS source.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const product =
      effectiveChoice.kind === 'iowa-state' &&
      (effectiveChoice.product.startsWith('nexrad-') ||
        effectiveChoice.product.startsWith('q2-'))
        ? effectiveChoice.product
        : 'nexrad-n0q-900913';
    const tilesUrl = iowaTs
      ? `/api/radar/iowa-state?z={z}&x={x}&y={y}&product=${product}&ts=${iowaTs}`
      : `/api/radar/iowa-state?z={z}&x={x}&y={y}&product=${product}`;
    const opacity =
      effectiveChoice.kind === 'iowa-state'
        ? effectiveChoice.opacity * overlay
        : 0;
    ensureRasterSource(map, IOWA_SOURCE, IOWA_LAYER, tilesUrl, {
      minzoom: 0,
      maxzoom: 12,
      opacity,
    });
  }, [
    map,
    styleLoaded,
    iowaTs,
    effectiveChoice.kind,
    effectiveChoice.product,
    effectiveChoice.opacity,
    overlay,
  ]);

  // Iowa composite probe → RainViewer fallback (May ladder).
  useEffect(() => {
    if (effectiveChoice.kind !== 'iowa-state' || !choice.fallback) return;
    let cancelled = false;
    const product = effectiveChoice.product.startsWith('nexrad-')
      ? effectiveChoice.product
      : 'nexrad-n0q-900913';
    void fetch(`/api/radar/iowa-state?z=5&x=7&y=12&product=${product}`)
      .then((res) => {
        if (!cancelled && !res.ok && choice.fallback) {
          setActiveKind(choice.fallback);
        }
      })
      .catch(() => {
        if (!cancelled && choice.fallback) setActiveKind(choice.fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveChoice.kind, effectiveChoice.product, choice.fallback]);

  // Open-Meteo wind / temp grid — scrubber drives the forecast hour.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const layer =
      effectiveChoice.kind === 'open-meteo-grid'
        ? effectiveChoice.product
        : 'wind';
    // Round scrubber ts to the UTC hour the tile API keys on.
    const hourIso = new Date(Math.floor(ts / 3600) * 3600 * 1000)
      .toISOString()
      .slice(0, 13);
    const url =
      `/api/weather/grid?z={z}&x={x}&y={y}&layer=${layer}` +
      (effectiveChoice.kind === 'open-meteo-grid'
        ? `&time=${encodeURIComponent(hourIso)}`
        : '');
    const opacity =
      effectiveChoice.kind === 'open-meteo-grid'
        ? effectiveChoice.opacity * overlay
        : 0;
    ensureRasterSource(map, GRID_SOURCE, GRID_LAYER, url, {
      minzoom: 2,
      maxzoom: 12,
      opacity,
      resampling: 'linear',
    });
  }, [
    map,
    styleLoaded,
    effectiveChoice.kind,
    effectiveChoice.product,
    effectiveChoice.opacity,
    overlay,
    ts,
  ]);

  // DWD
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (effectiveChoice.kind !== 'dwd') {
      removeImageLayer(map, DWD_SOURCE, DWD_LAYER);
      return;
    }

    let timer: number | undefined;

    const refresh = () => {
      const { bbox3857, coords } = bboxFromMap(map);
      const url = `/api/radar/dwd?bbox=${encodeURIComponent(
        bbox3857,
      )}&width=1024&height=1024`;
      putImageLayer(
        map,
        DWD_SOURCE,
        DWD_LAYER,
        url,
        coords,
        targetOpacityRef.current,
      );
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
  }, [
    map,
    styleLoaded,
    effectiveChoice.kind,
    effectiveChoice.opacity,
    overlay,
    ts,
  ]);

  // NASA GIBS — keep mounted; swap tiles when layer name changes.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const layerName =
      effectiveChoice.kind === 'gibs'
        ? effectiveChoice.product
        : 'GOES-East_ABI_Band13_Clean_Infrared';
    const url = gibsTileUrl(layerName);
    const isVis = /Visible|Band2/i.test(layerName);
    const opacity =
      effectiveChoice.kind === 'gibs'
        ? effectiveChoice.opacity * overlay
        : 0;
    ensureRasterSource(map, GIBS_SOURCE, GIBS_LAYER, url, {
      minzoom: 0,
      maxzoom: isVis ? 7 : 6,
      opacity,
    });
  }, [
    map,
    styleLoaded,
    effectiveChoice.kind,
    effectiveChoice.product,
    effectiveChoice.opacity,
    overlay,
  ]);

  // Iowa GOES vis / IR
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const product =
      effectiveChoice.kind === 'iowa-goes'
        ? effectiveChoice.product
        : 'goes-east-vis-1km-900913';
    const url = `/api/radar/iowa-state?z={z}&x={x}&y={y}&product=${product}`;
    const opacity =
      effectiveChoice.kind === 'iowa-goes'
        ? effectiveChoice.opacity * overlay
        : 0;
    ensureRasterSource(map, IOWA_GOES_SOURCE, IOWA_GOES_LAYER, url, {
      minzoom: 0,
      maxzoom: 10,
      opacity,
    });
  }, [
    map,
    styleLoaded,
    effectiveChoice.kind,
    effectiveChoice.product,
    effectiveChoice.opacity,
    overlay,
  ]);

  // Multi-site mosaic (velocity / rotation / CC / SRV at CONUS zoom).
  // Opacity/time changes must not remount — that blanked CONUS mosaics.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (effectiveChoice.kind !== 'mosaic') {
      removeImageLayer(map, MOSAIC_SOURCE, MOSAIC_LAYER);
      return;
    }

    let timer: number | undefined;
    let cancelled = false;
    let seq = 0;
    const urls = createRetiringUrlSlot();
    const label = labelFor(
      'mosaic',
      effectiveChoice.product,
      activeProduct,
      undefined,
    );

    const refresh = () => {
      if (cancelled || !map) return;
      const mySeq = ++seq;
      const { bbox3857, coords } = bboxFromMap(map);
      const url =
        `/api/radar/mosaic?product=${encodeURIComponent(effectiveChoice.product)}` +
        `&bbox=${encodeURIComponent(bbox3857)}&width=1024&height=1024`;
      setLayerLoading(label);

      void fetch(url)
        .then(async (res) => {
          if (cancelled) return;
          if (!res.ok) {
            if (choice.fallback) setActiveKind(choice.fallback);
            return;
          }
          const blob = await res.blob();
          if (cancelled || !map) return;
          // A mosaic takes seconds to render, so any pan in the meantime
          // used to invalidate the response and nothing ever mounted.
          // Superseded frames are only worth dropping once something is
          // already on screen.
          if (mySeq !== seq && map.getLayer(MOSAIC_LAYER)) return;
          putImageLayer(
            map,
            MOSAIC_SOURCE,
            MOSAIC_LAYER,
            urls.next(blob),
            coords,
            targetOpacityRef.current,
          );
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          // Only a transport failure should demote us to the fallback —
          // a mount error must not silently swap CONUS velocity for a
          // single-site footprint that is invisible at this zoom.
          if (err instanceof TypeError && choice.fallback) {
            setActiveKind(choice.fallback);
          }
        })
        .finally(() => {
          if (!cancelled && mySeq === seq) setLayerLoading(null);
        });
    };

    const debounced = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(refresh, 350);
    };

    refresh();
    map.on('moveend', debounced);
    return () => {
      cancelled = true;
      setLayerLoading(null);
      if (timer !== undefined) window.clearTimeout(timer);
      map.off('moveend', debounced);
      removeImageLayer(map, MOSAIC_SOURCE, MOSAIC_LAYER);
      urls.dispose();
    };
  }, [
    map,
    styleLoaded,
    effectiveChoice.kind,
    effectiveChoice.product,
    choice.fallback,
    activeProduct,
    setLayerLoading,
  ]);

  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (effectiveChoice.kind !== 'mosaic') return;
    setRasterOpacity(
      map,
      MOSAIC_LAYER,
      effectiveChoice.opacity * overlay,
    );
  }, [
    map,
    styleLoaded,
    effectiveChoice.kind,
    effectiveChoice.opacity,
    overlay,
  ]);

  // Per-site / CONUS WMS (always via transparent PNG factory on the server)
  const wmsProduct = (():
    | 'bref'
    | 'bvel'
    | 'cref'
    | 'neet'
    | 'pcpn'
    | 'bdhc'
    | 'boha'
    | 'bdsa' => {
    const p = effectiveChoice.product;
    if (p === 'bvel' || p === 'n0s') return 'bvel';
    if (p === 'cref') return 'cref';
    if (p === 'neet') return 'neet';
    if (p === 'pcpn') return 'pcpn';
    if (p === 'bdhc') return 'bdhc';
    if (p === 'boha') return 'boha';
    if (p === 'bdsa') return 'bdsa';
    return 'bref';
  })();
  const wmsSite =
    effectiveChoice.product === 'cref' ||
    effectiveChoice.product === 'conus-bref' ||
    effectiveChoice.product === 'neet' ||
    effectiveChoice.product === 'pcpn'
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
    siteLat: wmsSite && wmsSite !== 'conus' ? (site?.lat ?? null) : null,
    siteLon: wmsSite && wmsSite !== 'conus' ? (site?.lon ?? null) : null,
    time: wmsTime ?? null,
    opacity: effectiveChoice.opacity * overlay,
    onStatus: (status) => {
      if (status.ok) {
        setWmsFailReason(null);
        return;
      }
      setWmsFailReason(status.error ?? 'WMS unavailable');
      // Keep last good frame; only fall back if nothing mounted yet.
      if (choice.fallback && map && !map.getSource(WMS_SOURCE_ID)) {
        setActiveKind(choice.fallback);
      }
    },
  });

  // Force-remove WMS when another product owns the map (black-map defence).
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (effectiveChoice.kind === 'ridge-wms') return;
    removeImageLayer(map, WMS_SOURCE_ID, WMS_LAYER_ID);
  }, [map, styleLoaded, effectiveChoice.kind]);

  // Iowa GOES tile probe → GIBS fallback when declared.
  useEffect(() => {
    if (effectiveChoice.kind !== 'iowa-goes' || !choice.fallback) return;
    let cancelled = false;
    const product = effectiveChoice.product;
    void fetch(`/api/radar/iowa-state?z=4&x=3&y=6&product=${product}`)
      .then((res) => {
        if (!cancelled && !res.ok && choice.fallback) {
          setActiveKind(choice.fallback);
        }
      })
      .catch(() => {
        if (!cancelled && choice.fallback) setActiveKind(choice.fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveChoice.kind, effectiveChoice.product, choice.fallback]);

  // Level 2
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (effectiveChoice.kind !== 'level2' || !site) {
      removeImageLayer(map, L2_SOURCE, L2_LAYER);
      return;
    }

    const siteId = site.id;
    const siteLon = site.lon;
    const siteLat = site.lat;
    const product = effectiveChoice.product;
    const label = labelFor('level2', product, activeProduct, site);
    let cancelled = false;
    let interval: number | undefined;
    const urls = createRetiringUrlSlot();

    const load = async () => {
      setLayerLoading(label);
      try {
        const res = await fetch(
          `/api/radar/level2?site=${siteId}&product=${product}`,
        );
        if (!res.ok) {
          if (choice.fallback) setActiveKind(choice.fallback);
          return;
        }
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
          url = urls.next(blob);
          const hdr = res.headers.get('X-Bbox');
          if (hdr) {
            const parts = hdr.split(',').map(Number);
            bbox = [parts[0], parts[1], parts[2], parts[3]];
          } else {
            bbox = [siteLon - 2.5, siteLat - 2.5, siteLon + 2.5, siteLat + 2.5];
          }
        }
        if (cancelled || !map) return;

        const [w, s, e, n] = bbox;
        const coords: ImageCorners = [
          [w, n],
          [e, n],
          [e, s],
          [w, s],
        ];
        putImageLayer(
          map,
          L2_SOURCE,
          L2_LAYER,
          url,
          coords,
          targetOpacityRef.current,
        );
      } catch {
        if (choice.fallback) setActiveKind(choice.fallback);
      } finally {
        if (!cancelled) setLayerLoading(null);
      }
    };

    void load();
    interval = window.setInterval(() => void load(), 5 * 60_000);

    return () => {
      cancelled = true;
      setLayerLoading(null);
      if (interval !== undefined) window.clearInterval(interval);
      urls.dispose();
    };
  }, [
    map,
    styleLoaded,
    effectiveChoice.kind,
    effectiveChoice.product,
    site,
    choice.fallback,
    activeProduct,
    setLayerLoading,
  ]);

  // Level 3 (N0S / ROT)
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (effectiveChoice.kind !== 'level3' || !site) {
      removeImageLayer(map, L3_SOURCE, L3_LAYER);
      return;
    }

    const siteId = site.id;
    const siteLon = site.lon;
    const siteLat = site.lat;
    const product = effectiveChoice.product;
    const label = labelFor('level3', product, activeProduct, site);
    let cancelled = false;
    let interval: number | undefined;
    const urls = createRetiringUrlSlot();

    const load = async () => {
      setLayerLoading(label);
      try {
        const res = await fetch(
          `/api/radar/level3?site=${siteId}&product=${product}`,
        );
        if (!res.ok) {
          if (choice.fallback) setActiveKind(choice.fallback);
          return;
        }
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
          url = urls.next(blob);
          const hdr = res.headers.get('X-Bbox');
          if (hdr) {
            const parts = hdr.split(',').map(Number);
            bbox = [parts[0], parts[1], parts[2], parts[3]];
          } else {
            bbox = [siteLon - 2.5, siteLat - 2.5, siteLon + 2.5, siteLat + 2.5];
          }
        }
        if (cancelled || !map) return;

        const [w, s, e, n] = bbox;
        const coords: ImageCorners = [
          [w, n],
          [e, n],
          [e, s],
          [w, s],
        ];
        putImageLayer(
          map,
          L3_SOURCE,
          L3_LAYER,
          url,
          coords,
          targetOpacityRef.current,
        );
      } catch {
        // Non-fatal — banner still shows US-only context.
      } finally {
        if (!cancelled) setLayerLoading(null);
      }
    };

    void load();
    interval = window.setInterval(() => void load(), 5 * 60_000);

    return () => {
      cancelled = true;
      setLayerLoading(null);
      if (interval !== undefined) window.clearInterval(interval);
      urls.dispose();
    };
  }, [
    map,
    styleLoaded,
    effectiveChoice.kind,
    effectiveChoice.product,
    site,
    choice.fallback,
    activeProduct,
    setLayerLoading,
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
    fadeRasterTo(map, MOSAIC_LAYER, kind === 'mosaic' ? target : 0);
    fadeRasterTo(map, DWD_LAYER, kind === 'dwd' ? target : 0);
    fadeRasterTo(map, GIBS_LAYER, kind === 'gibs' ? target : 0);
    fadeRasterTo(map, IOWA_GOES_LAYER, kind === 'iowa-goes' ? target : 0);
    fadeRasterTo(map, GRID_LAYER, kind === 'open-meteo-grid' ? target : 0);
    fadeRasterTo(map, WMS_LAYER_ID, kind === 'ridge-wms' ? target : 0);
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
