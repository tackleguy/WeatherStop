// Always-mounted Windy raster layer. Time / product changes swap the
// tile URLs in place via setTiles, so no add/remove churn — opacity is
// the only thing useRadarStack toggles.

import maplibregl from 'maplibre-gl';
import { useEffect } from 'react';

export const WINDY_SOURCE_ID = 'windy-radar';
export const WINDY_LAYER_ID = 'windy-radar-layer';

interface Args {
  map: maplibregl.Map | null;
  /** Active timestamp (epoch seconds, snapped to 10-min). */
  ts: number;
  /** Windy product slug — 'radar', 'satellite', etc. */
  product?: string;
}

function tileUrl(ts: number, product: string): string {
  return `/api/radar/windy?z={z}&x={x}&y={y}&ts=${ts}&product=${product}`;
}

export function useWindyLayer({ map, ts, product = 'radar' }: Args) {
  useEffect(() => {
    if (!map) return;

    const attach = () => {
      const url = tileUrl(ts, product);
      const existing = map.getSource(WINDY_SOURCE_ID) as
        | (maplibregl.RasterTileSource & { setTiles?: (urls: string[]) => void })
        | undefined;
      if (existing && typeof existing.setTiles === 'function') {
        existing.setTiles([url]);
        return;
      }
      if (existing) return; // can't update; leave alone
      map.addSource(WINDY_SOURCE_ID, {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 12,
        attribution:
          'Radar © <a href="https://windy.com" target="_blank" rel="noopener">Windy.com</a>',
      });
      map.addLayer({
        id: WINDY_LAYER_ID,
        type: 'raster',
        source: WINDY_SOURCE_ID,
        paint: {
          'raster-opacity': 0.75,
          'raster-fade-duration': 400,
          'raster-resampling': 'linear',
        },
      });
    };

    if (map.isStyleLoaded()) attach();
    else map.once('load', attach);

    return () => {
      map.off('load', attach);
    };
  }, [map, ts, product]);
}
