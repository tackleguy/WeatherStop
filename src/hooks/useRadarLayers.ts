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
//   • RainViewer          — global radar / IR satellite XYZ tiles
//   • NOAA GOES           — visible / IR ImageServer
//   • Open-Meteo grid     — server-rendered wind / temp tiles
//
// All raster layers use raster-resampling: 'nearest' and fade-duration
// of 0 — that's the RadarScope-style sharp-pixel look. Smoothing is
// applied at the source level (e.g. RainViewer color=7,smooth=0).

import maplibregl from 'maplibre-gl';
import { useEffect, useMemo } from 'react';
import { fadeRasterTo } from '../lib/crossfade';
import { type ProductId } from '../constants/products';
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
import { detectRegion } from '../lib/regionDetect';
import {
  resolveSource,
  unavailabilityReason,
  type SourceChoice,
  type SourceKind,
} from '../lib/sourceResolver';
import { metersBboxFromLngLat } from '../lib/mercator';

export const RAINVIEWER_SOURCE = 'rainviewer-tiles';
export const RAINVIEWER_LAYER = 'rainviewer-layer';
export const IOWA_SOURCE = 'iowa-tiles';
export const IOWA_LAYER = 'iowa-layer';
export const NWS_SOURCE = 'nws-overlay';
export const NWS_LAYER = 'nws-overlay-layer';
export const L2_SOURCE = 'level2-overlay';
export const L2_LAYER = 'level2-layer';
export const DWD_SOURCE = 'dwd-overlay';
export const DWD_LAYER = 'dwd-overlay-layer';
export const GOES_SOURCE = 'goes-overlay';
export const GOES_LAYER = 'goes-overlay-layer';
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
    color: 7,
    smooth: 0,
    snow: 1,
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
    case 'noaa-goes':
      return '© <a href="https://www.weather.gov" target="_blank" rel="noopener">NOAA GOES</a>';
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
  if (kind === 'noaa-goes') {
    return product === 'band_2' ? 'GOES Visible' : 'GOES Infrared';
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
  // RainViewer XYZ source — radar OR satellite tiles.
  // The RainViewer endpoint also accepts a server-side resolved frame
  // (kind=satellite|radar). We use the catalog-direct URL because it
  // avoids an extra hop, but switch to /api/radar/rainviewer when we
  // hit RainViewer rate limits.
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
      paint: PIXELATED_PAINT,
    });
  }, [map, styleLoaded, activeProduct, catalog, frameIndex]);

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
  }, [map, styleLoaded, choice.kind, choice.product]);

  // DWD WMS — German radar. Image source updated per viewport.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (choice.kind !== 'dwd') {
      if (map.getLayer(DWD_LAYER)) map.removeLayer(DWD_LAYER);
      if (map.getSource(DWD_SOURCE)) map.removeSource(DWD_SOURCE);
      return;
    }

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
      map.addSource(DWD_SOURCE, { type: 'image', url, coordinates: coords });
      map.addLayer({
        id: DWD_LAYER,
        type: 'raster',
        source: DWD_SOURCE,
        paint: PIXELATED_PAINT,
      });
    };

    refresh();
    const handler = () => refresh();
    map.on('moveend', handler);
    return () => {
      map.off('moveend', handler);
    };
  }, [map, styleLoaded, choice.kind, ts]);

  // NOAA GOES ImageServer — visible / IR over US.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (choice.kind !== 'noaa-goes') {
      if (map.getLayer(GOES_LAYER)) map.removeLayer(GOES_LAYER);
      if (map.getSource(GOES_SOURCE)) map.removeSource(GOES_SOURCE);
      return;
    }
    const band = choice.product === 'band_2' ? '2' : '13';

    const refresh = () => {
      const { bbox4326, coords } = bboxFromMap(map);
      const url = `/api/satellite/noaa-goes?bbox=${encodeURIComponent(
        bbox4326,
      )}&band=${band}&width=1024&height=1024`;
      const src = map.getSource(GOES_SOURCE) as
        | maplibregl.ImageSource
        | undefined;
      if (src) {
        src.updateImage({ url, coordinates: coords });
        return;
      }
      map.addSource(GOES_SOURCE, { type: 'image', url, coordinates: coords });
      map.addLayer({
        id: GOES_LAYER,
        type: 'raster',
        source: GOES_SOURCE,
        paint: PIXELATED_PAINT,
      });
    };

    refresh();
    const handler = () => refresh();
    map.on('moveend', handler);
    return () => {
      map.off('moveend', handler);
    };
  }, [map, styleLoaded, choice.kind, choice.product, ts]);

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
  // Layers that aren't mounted (because we tear them down on kind
  // changes) get a no-op fade thanks to fadeRasterTo's existence check.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const target = choice.opacity * overlay;
    fadeRasterTo(map, RAINVIEWER_LAYER, choice.kind === 'rainviewer' ? target : 0);
    fadeRasterTo(map, IOWA_LAYER, choice.kind === 'iowa-state' ? target : 0);
    fadeRasterTo(map, L2_LAYER, choice.kind === 'level2' ? target : 0);
    fadeRasterTo(map, DWD_LAYER, choice.kind === 'dwd' ? target : 0);
    fadeRasterTo(map, GOES_LAYER, choice.kind === 'noaa-goes' ? target : 0);
    fadeRasterTo(map, GRID_LAYER, choice.kind === 'open-meteo-grid' ? target : 0);
    // The deprecated nws-overlay layer ID is kept around for any
    // bookmarked or cached map state pointing at it; force it off.
    fadeRasterTo(map, NWS_LAYER, 0);
  }, [map, styleLoaded, choice, overlay]);

  return plan;
}
