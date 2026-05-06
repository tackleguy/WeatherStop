// Layer orchestration. Maintains:
//   • a RainViewer raster tile source for the radar / satellite overlays
//     (keyless public service used by RadrView; replaced Windy after
//     WINDY_KEY became a deployment liability).
//   • an NWS-overlay image source for products that come from the NOAA
//     mapservices ImageServer (velocity, SRV, echo tops, VIL).
//
// Crossfade between the two is driven by the active product. Source ids
// stay stable so RadarMap can hand-edit other layers (alerts focus, etc.)
// in any order.

import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { fadeRasterTo } from '../lib/crossfade';
import { getProduct, type ProductId } from '../constants/products';
import {
  buildTileUrl,
  getFrames,
  placeholderTileUrl,
  type RainViewerCatalog,
} from '../lib/rainviewer';
import { useRadarStore } from '../store/useRadarStore';

export const RAINVIEWER_SOURCE = 'rainviewer-tiles';
export const RAINVIEWER_LAYER = 'rainviewer-layer';
export const NWS_SOURCE = 'nws-overlay';
export const NWS_LAYER = 'nws-overlay-layer';

interface Args {
  map: maplibregl.Map | null;
  styleLoaded: boolean;
  activeProduct: ProductId;
  /** RainViewer catalog (from useRainViewer). May be undefined briefly
   *  on first paint while SWR is fetching. */
  catalog: RainViewerCatalog | undefined;
  /** Currently-selected frame index into the radar/satellite frame list. */
  frameIndex: number;
  /** Active timestamp in epoch seconds for the NWS overlay's `time=` param.
   *  Falls back to "now" inside the NWS branch when needed. */
  ts: number;
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

function tileUrlFor(
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
    // Color 2 = Universal Blue (default radar palette). For satellite the
    // server picks a sensible default when color = 0.
    color: isSatellite ? undefined : 2,
    smooth: 1,
    snow: 1,
  });
}

export function useRadarLayers({
  map,
  styleLoaded,
  activeProduct,
  catalog,
  frameIndex,
  ts,
}: Args) {
  // RainViewer tiles. Mount once, swap tile URLs as the catalog +
  // frame index update.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const url = tileUrlFor(activeProduct, catalog, frameIndex);

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
      attribution:
        '© <a href="https://rainviewer.com" target="_blank" rel="noopener">RainViewer</a>',
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

  // NWS overlay (velocity / SRV / echo tops / VIL) — image source that
  // refreshes on every settled map move + ts change.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const product = getProduct(activeProduct);
    if (product.layer !== 'nws-overlay' || !product.nwsProduct) return;

    const refresh = () => {
      const { bbox, coords } = bboxFromMap(map);
      const url = `/api/radar/nws-overlay?bbox=${encodeURIComponent(
        bbox,
      )}&size=2048,2048&service=${product.nwsProduct}&time=${ts * 1000}`;

      const src = map.getSource(NWS_SOURCE) as
        | maplibregl.ImageSource
        | undefined;
      if (src) {
        src.updateImage({ url, coordinates: coords });
        return;
      }
      map.addSource(NWS_SOURCE, {
        type: 'image',
        url,
        coordinates: coords,
      });
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
  }, [map, styleLoaded, activeProduct, ts]);

  // Crossfade by active layer source. Multiplied by the user's
  // overlayOpacity slider so it composes cleanly on top.
  const overlay = useRadarStore((s) => s.overlayOpacity);
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const product = getProduct(activeProduct);
    const isRainViewer =
      product.layer === 'windy' || product.id === 'satellite-ir' || product.id === 'satellite-vis';
    const isNWS = product.layer === 'nws-overlay';
    const rvTarget = isRainViewer ? 0.85 : 0;
    const nwsTarget = isNWS ? 0.85 : 0;
    fadeRasterTo(map, RAINVIEWER_LAYER, rvTarget * overlay);
    fadeRasterTo(map, NWS_LAYER, nwsTarget * overlay);
    void getFrames; // re-export side-effect kept for callers using the symbol
  }, [map, styleLoaded, activeProduct, overlay]);
}
