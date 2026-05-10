// Layer orchestration for the radar map. Each frame the resolver picks
// the right upstream service for the active product × zoom × region;
// this hook mounts the corresponding MapLibre source on demand and
// crossfades all the others to opacity 0.
//
// Sources, in resolver-priority order:
//   • Iowa State Mesonet  — CONUS XYZ composite (z 0–9)
//   • NWS RIDGE per-site  — WMS image (z 10–11)
//   • NEXRAD Level 2      — server-rendered PNG (z 12+)
//   • DWD                 — German precipitation WMS
//   • RainViewer (radar)  — global radar XYZ tiles (color=7, smooth=0)
//   • RainViewer (sat)    — global IR satellite XYZ tiles (color=0)
//   • NOAA GOES           — visible / IR ImageServer
//   • Open-Meteo grid     — server-rendered wind / temp tiles
//
// All raster layers use raster-resampling: 'nearest' and fade-duration
// 0 — that's the RadarScope-style sharp-pixel look.
//
// Mount discipline: every addSource/addLayer is wrapped in a
// `safeAdd` helper that (a) verifies the style is fully loaded and
// (b) bails if the source / layer already exists. MapLibre throws on
// duplicate adds, and StrictMode's double-invocation will trip it
// every time without this guard.

import maplibregl from 'maplibre-gl';
import { useEffect, useMemo } from 'react';
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

// Legacy radar layer ID — kept exported so any module that imports it
// continues to compile, but unused at runtime.
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
export const DWD_SOURCE = 'dwd-overlay';
export const DWD_LAYER = 'dwd-overlay-layer';
export const GIBS_IR_SOURCE = 'gibs-ir-tiles';
export const GIBS_IR_LAYER = 'gibs-ir-layer';
export const IOWA_GOES_VIS_SOURCE = 'iowa-goes-vis-tiles';
export const IOWA_GOES_VIS_LAYER = 'iowa-goes-vis-layer';
export const GRID_SOURCE = 'open-meteo-grid';
export const GRID_LAYER = 'open-meteo-grid-layer';

// Mirrored back to the store / LayerInfoCard so the chip can show what
// the user is actually looking at.
export interface SourcePlan {
  kind: SourceKind | 'unavailable';
  label: string;
  attribution: string;
  opacity: number;
  /** Set when the active source is keyed to a specific NEXRAD site. */
  site?: NexradSite;
  /** Set when an upstream isn't available in the active region. */
  unavailableReason?: string | null;
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

const PIXELATED_PAINT: maplibregl.RasterLayerSpecification['paint'] = {
  'raster-opacity': 0,
  'raster-fade-duration': 0,
  'raster-resampling': 'nearest',
};

/** Style-aware idempotent addSource/addLayer helper. */
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

function attributionFor(kind: SourceKind): string {
  switch (kind) {
    case 'iowa-state':
      return '© <a href="https://mesonet.agron.iastate.edu" target="_blank" rel="noopener">Iowa State Mesonet</a>';
    case 'rainviewer':
      return '© <a href="https://rainviewer.com" target="_blank" rel="noopener">RainViewer</a>';
    case 'ridge-wms':
      return '© <a href="https://www.weather.gov" target="_blank" rel="noopener">NWS</a>';
    case 'level2':
      return '© <a href="https://www.weather.gov" target="_blank" rel="noopener">NWS NEXRAD Level 2</a>';
    case 'dwd':
      return '© <a href="https://www.dwd.de" target="_blank" rel="noopener">DWD</a>';
    case 'gibs-ir':
      return '© <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a> · GOES-East ABI';
    case 'iowa-goes-vis':
      return '© <a href="https://mesonet.agron.iastate.edu" target="_blank" rel="noopener">Iowa State Mesonet</a> · GOES-East Visible';
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
    return product === 'satellite' ? 'Satellite (RainViewer)' : 'Reflectivity (RainViewer)';
  }
  if (kind === 'ridge-wms' && site) {
    return `${site.id} · ${product === 'bvel' ? 'Base Velocity' : 'Reflectivity'}`;
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
  if (kind === 'dwd') return 'DWD Niederschlagsradar';
  if (kind === 'gibs-ir') return 'GOES-East · Infrared (NASA GIBS)';
  if (kind === 'iowa-goes-vis') return 'GOES-East · Visible (Iowa State)';
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

  const region = useMemo(() => detectRegion(lon, lat), [lon, lat]);

  const choice: SourceChoice = useMemo(
    () => resolveSource(activeProduct, mapZoom, region),
    [activeProduct, mapZoom, region],
  );

  const reason = useMemo(
    () => unavailabilityReason(activeProduct, mapZoom, region),
    [activeProduct, mapZoom, region],
  );

  // Pick the radar site for site-keyed sources (ridge-wms / level2).
  const site = useMemo<NexradSite | undefined>(() => {
    if (choice.kind !== 'ridge-wms' && choice.kind !== 'level2') return undefined;
    return manualSite ?? nearestNexradSite(lon, lat);
  }, [choice.kind, manualSite, lon, lat]);

  const isSatelliteProduct =
    activeProduct === 'satellite-ir' || activeProduct === 'satellite-vis';

  const plan = useMemo<SourcePlan>(() => {
    return {
      kind: choice.opacity === 0 ? 'unavailable' : choice.kind,
      label: labelFor(choice.kind, choice.product, activeProduct, site),
      attribution: attributionFor(choice.kind),
      opacity: choice.opacity,
      site,
      unavailableReason: reason,
    };
  }, [choice, site, activeProduct, reason]);

  // ─────────────────────────────────────────────────────────────────
  // RainViewer radar XYZ source — global precipitation, sharp gates.
  // Mounted once; setTiles swaps the URL when the time-scrubber moves.
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

  // RainViewer satellite IR XYZ source — global cloud cover. Different
  // upstream URL (color=0) and lower native maxzoom than radar.
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

  // Iowa State XYZ — historical or live.
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
  }, [map, styleLoaded, iowaTs]);

  // Open-Meteo wind / temp grid — XYZ tiles, layer-keyed.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (choice.kind !== 'open-meteo-grid') return;
    const url = `/api/weather/grid?z={z}&x={x}&y={y}&layer=${choice.product}`;

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
  }, [map, styleLoaded, choice.kind, choice.product]);

  // DWD WMS — German radar. Image source updated per viewport.
  // 300ms debounce prevents thrashing the DWD GeoServer during pans.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (choice.kind !== 'dwd') {
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
  }, [map, styleLoaded, choice.kind, ts]);

  // NASA GIBS GOES IR — global infrared cloud cover. WMTS endpoint
  // serves a {z}/{y}/{x}.png path that we hand straight to MapLibre.
  // GIBS publishes a "default" tile-matrix-set per layer that updates
  // at the source's native cadence (~10 min for ABI Band 13).
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const layerName = choice.product;
    const url =
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/` +
      `${layerName}/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;

    const existing = map.getSource(GIBS_IR_SOURCE) as
      | (maplibregl.RasterTileSource & { setTiles?: (urls: string[]) => void })
      | undefined;
    if (existing && typeof existing.setTiles === 'function') {
      existing.setTiles([url]);
      return;
    }
    if (existing) return;
    safeAdd(map, styleLoaded, () => {
      if (map.getSource(GIBS_IR_SOURCE)) return;
      map.addSource(GIBS_IR_SOURCE, {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 6,
      });
      map.addLayer({
        id: GIBS_IR_LAYER,
        type: 'raster',
        source: GIBS_IR_SOURCE,
        paint: PIXELATED_PAINT,
      });
    });
  }, [map, styleLoaded, choice.product]);

  // Iowa State Mesonet GOES visible (1km, US-east). XYZ tiles via the
  // existing /api/radar/iowa-state proxy — `product` param already
  // allow-lists `goes-east-vis-1km-900913`.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const url = `/api/radar/iowa-state?z={z}&x={x}&y={y}&product=goes-east-vis-1km-900913`;
    const existing = map.getSource(IOWA_GOES_VIS_SOURCE) as
      | maplibregl.RasterTileSource
      | undefined;
    if (existing) return;
    safeAdd(map, styleLoaded, () => {
      if (map.getSource(IOWA_GOES_VIS_SOURCE)) return;
      map.addSource(IOWA_GOES_VIS_SOURCE, {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 10,
      });
      map.addLayer({
        id: IOWA_GOES_VIS_LAYER,
        type: 'raster',
        source: IOWA_GOES_VIS_SOURCE,
        paint: PIXELATED_PAINT,
      });
    });
  }, [map, styleLoaded]);

  // Per-site WMS layer — handled by its own hook.
  useWmsSiteLayer({
    map,
    styleLoaded,
    enabled: choice.kind === 'ridge-wms',
    site: site ? site.id.toLowerCase() : null,
    product: choice.product === 'bvel' ? 'bvel' : 'bref',
    opacity: choice.opacity * overlay,
  });

  // NEXRAD Level 2 image source.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (choice.kind !== 'level2' || !site) {
      if (map.getLayer(L2_LAYER)) map.removeLayer(L2_LAYER);
      if (map.getSource(L2_SOURCE)) map.removeSource(L2_SOURCE);
      return;
    }

    const siteId = site.id;
    const product = choice.product;
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
        // L2 failures are non-fatal — RIDGE is still available below.
      }
    };

    load();
    interval = window.setInterval(load, 5 * 60_000);

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [map, styleLoaded, choice.kind, choice.product, site?.id]);

  // Crossfade — set every layer's opacity each time the choice changes.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const target = choice.opacity * overlay;

    const showRvRadar = choice.kind === 'rainviewer' && !isSatelliteProduct;

    fadeRasterTo(map, RAINVIEWER_RADAR_LAYER, showRvRadar ? target : 0);
    // The rainviewer-satellite source is kept mounted but always hidden
    // — RainViewer's free manifest no longer publishes satellite frames
    // (verified 2026-05-10). Satellite IR now comes from GIBS.
    fadeRasterTo(map, RAINVIEWER_SAT_LAYER, 0);
    fadeRasterTo(map, IOWA_LAYER, choice.kind === 'iowa-state' ? target : 0);
    fadeRasterTo(map, L2_LAYER, choice.kind === 'level2' ? target : 0);
    fadeRasterTo(map, DWD_LAYER, choice.kind === 'dwd' ? target : 0);
    fadeRasterTo(map, GIBS_IR_LAYER, choice.kind === 'gibs-ir' ? target : 0);
    fadeRasterTo(
      map,
      IOWA_GOES_VIS_LAYER,
      choice.kind === 'iowa-goes-vis' ? target : 0,
    );
    fadeRasterTo(map, GRID_LAYER, choice.kind === 'open-meteo-grid' ? target : 0);
    fadeRasterTo(map, NWS_LAYER, 0);
  }, [map, styleLoaded, choice, overlay, isSatelliteProduct]);

  return plan;
}
