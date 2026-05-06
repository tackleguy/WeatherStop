// Layer orchestration. Maintains:
//   • a Windy raster source (always mounted, swapped via setTiles when
//     ts/product change),
//   • an NWS-overlay image source (always mounted, image refreshed on
//     viewport changes when the active product is an nws-overlay),
//   • crossfade between the two driven by the active product (Windy
//     visible when Windy product, NWS visible when NWS product, both
//     hidden for placeholder products like 'lightning').
//
// Source IDs are stable so RadarMap can hand-edit layers (e.g. for
// alert-fly-to highlight stroking).

import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { fadeRasterTo } from '../lib/crossfade';
import { getProduct, type ProductId } from '../constants/products';
import { windyTileUrl } from '../lib/windy';

export const WINDY_SOURCE = 'windy-radar';
export const WINDY_LAYER = 'windy-radar-layer';
export const NWS_SOURCE = 'nws-overlay';
export const NWS_LAYER = 'nws-overlay-layer';

interface Args {
  map: maplibregl.Map | null;
  styleLoaded: boolean;
  activeProduct: ProductId;
  ts: number; // epoch seconds, snapped to 10-min
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

export function useRadarLayers({ map, styleLoaded, activeProduct, ts }: Args) {
  // Mount Windy source/layer once; tiles swap via setTiles for ts/product.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const product = getProduct(activeProduct);
    const slug = product.windyProduct ?? 'radar';
    const endpoint =
      product.id === 'satellite-ir' || product.id === 'satellite-vis'
        ? 'satellite'
        : 'radar';
    const url = windyTileUrl({ product: slug, ts, endpoint });

    const existing = map.getSource(WINDY_SOURCE) as
      | (maplibregl.RasterTileSource & { setTiles?: (urls: string[]) => void })
      | undefined;

    if (existing && typeof existing.setTiles === 'function') {
      existing.setTiles([url]);
    } else if (!existing) {
      map.addSource(WINDY_SOURCE, {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 12,
        attribution: '© <a href="https://windy.com">Windy.com</a>',
      });
      map.addLayer({
        id: WINDY_LAYER,
        type: 'raster',
        source: WINDY_SOURCE,
        paint: {
          'raster-opacity': 0,
          'raster-fade-duration': 400,
          'raster-resampling': 'linear',
        },
      });
    }
  }, [map, styleLoaded, activeProduct, ts]);

  // Mount NWS overlay; image refreshes on viewport change + ts.
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

  // Crossfade by active layer source.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const product = getProduct(activeProduct);
    const isWindy = product.layer === 'windy';
    const isNWS = product.layer === 'nws-overlay';
    fadeRasterTo(map, WINDY_LAYER, isWindy ? 0.78 : 0);
    fadeRasterTo(map, NWS_LAYER, isNWS ? 0.85 : 0);
  }, [map, styleLoaded, activeProduct]);
}
