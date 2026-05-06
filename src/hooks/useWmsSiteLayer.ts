// Per-site NWS WMS layer. The upstream serves a single georeferenced
// image per request, so we drive a MapLibre image source that gets
// updateImage()'d whenever the viewport settles. Debounced so a fast
// pan doesn't fire one request per pixel.
//
// Used for both per-site reflectivity (`bref`) and base velocity
// (`bvel`). Pass `enabled=false` (or null `site`) to mount nothing.

import maplibregl from 'maplibre-gl';
import { useEffect } from 'react';
import { metersBboxFromLngLat } from '../lib/mercator';

export const WMS_SOURCE_ID = 'wms-site-overlay';
export const WMS_LAYER_ID = 'wms-site-layer';

interface Args {
  map: maplibregl.Map | null;
  styleLoaded: boolean;
  enabled: boolean;
  site: string | null; // ICAO (any case) or 'conus'
  product: 'bref' | 'bvel';
  /** When true the layer is mounted with reduced opacity so the user can
   *  still see the underlying basemap. */
  opacity?: number;
}

const DEBOUNCE_MS = 300;

function bboxFromMap(map: maplibregl.Map) {
  const b = map.getBounds();
  return {
    bbox: metersBboxFromLngLat(b.getWest(), b.getSouth(), b.getEast(), b.getNorth()),
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

export function useWmsSiteLayer({
  map,
  styleLoaded,
  enabled,
  site,
  product,
  opacity = 0.9,
}: Args) {
  useEffect(() => {
    if (!map || !styleLoaded) return;

    function teardown() {
      if (!map) return;
      if (map.getLayer(WMS_LAYER_ID)) map.removeLayer(WMS_LAYER_ID);
      if (map.getSource(WMS_SOURCE_ID)) map.removeSource(WMS_SOURCE_ID);
    }

    if (!enabled || !site) {
      teardown();
      return;
    }

    let timer: number | undefined;
    let cancelled = false;

    const apply = () => {
      if (cancelled || !map) return;
      const { bbox, coords } = bboxFromMap(map);
      const params = new URLSearchParams({
        site,
        product,
        bbox,
        width: '1024',
        height: '1024',
      });
      const url = `/api/radar/wms-site?${params.toString()}`;

      const existing = map.getSource(WMS_SOURCE_ID) as
        | maplibregl.ImageSource
        | undefined;
      if (existing) {
        existing.updateImage({ url, coordinates: coords });
        return;
      }
      map.addSource(WMS_SOURCE_ID, {
        type: 'image',
        url,
        coordinates: coords,
      });
      map.addLayer({
        id: WMS_LAYER_ID,
        type: 'raster',
        source: WMS_SOURCE_ID,
        paint: {
          'raster-opacity': opacity,
          'raster-fade-duration': 400,
          'raster-resampling': 'linear',
        },
      });
    };

    const debouncedApply = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(apply, DEBOUNCE_MS);
    };

    apply();
    map.on('moveend', debouncedApply);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      map.off('moveend', debouncedApply);
      teardown();
    };
  }, [map, styleLoaded, enabled, site, product, opacity]);

  // Update opacity in place when caller changes it without remounting.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (!map.getLayer(WMS_LAYER_ID)) return;
    map.setPaintProperty(WMS_LAYER_ID, 'raster-opacity', opacity);
  }, [map, styleLoaded, opacity]);
}
