// Raster-tile satellite layer powered by SSEC RealEarth. RealEarth serves
// GOES-East/West products on standard {z}/{x}/{y} URLs with no key, so we
// bypass the proxy and let MapLibre fetch tiles directly.
//
// The `globalir` product is a worldwide IR composite that updates every
// ~15 minutes; `globalvis` is the daytime visible counterpart (dark over
// most of the globe at night, but accurate where the sun is up).

import maplibregl from 'maplibre-gl';
import { useEffect } from 'react';

export const SAT_SOURCE_ID = 'satellite-overlay';
export const SAT_LAYER_ID = 'satellite-overlay-layer';

const REALEARTH_PRODUCTS: Record<'ir' | 'vis', string> = {
  ir: 'globalir',
  vis: 'globalvis',
};

interface Args {
  map: maplibregl.Map | null;
  enabled: boolean;
  product: 'ir' | 'vis';
}

function tileUrl(product: 'ir' | 'vis'): string {
  const slug = REALEARTH_PRODUCTS[product];
  return `https://realearth.ssec.wisc.edu/api/image?products=${slug}&time=latest&x={x}&y={y}&z={z}`;
}

export function useSatelliteLayer({ map, enabled, product }: Args) {
  useEffect(() => {
    if (!map) return;

    function teardown() {
      if (!map) return;
      if (map.getLayer(SAT_LAYER_ID)) map.removeLayer(SAT_LAYER_ID);
      if (map.getSource(SAT_SOURCE_ID)) map.removeSource(SAT_SOURCE_ID);
    }

    if (!enabled) {
      if (map.isStyleLoaded()) teardown();
      return;
    }

    const apply = () => {
      if (!map) return;
      const url = tileUrl(product);

      const existing = map.getSource(SAT_SOURCE_ID) as
        | (maplibregl.RasterTileSource & { setTiles?: (urls: string[]) => void })
        | undefined;
      if (existing && typeof existing.setTiles === 'function') {
        existing.setTiles([url]);
        return;
      }
      if (existing) return;

      map.addSource(SAT_SOURCE_ID, {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 7, // RealEarth tile cache caps here for global products
        attribution:
          'Satellite © <a href="https://realearth.ssec.wisc.edu" target="_blank" rel="noopener">SSEC RealEarth</a>',
      });
      map.addLayer({
        id: SAT_LAYER_ID,
        type: 'raster',
        source: SAT_SOURCE_ID,
        paint: {
          'raster-opacity': 0.85,
          'raster-fade-duration': 400,
          'raster-resampling': 'linear',
        },
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);

    return () => {
      teardown();
    };
  }, [map, enabled, product]);
}
