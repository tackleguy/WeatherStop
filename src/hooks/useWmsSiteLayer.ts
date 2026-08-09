// Per-site NWS WMS layer. The upstream serves a single georeferenced
// image per request, so we drive a MapLibre image source that gets
// updateImage()'d whenever the viewport settles. Debounced so a fast
// pan doesn't fire one request per pixel.
//
// All requests go through /api/radar/wms-site which hardcodes
// transparent=true + format=image/png (black-map defence).

import maplibregl from 'maplibre-gl';
import { useEffect } from 'react';
import { metersBboxFromLngLat } from '../lib/mercator';

export const WMS_SOURCE_ID = 'wms-site-overlay';
export const WMS_LAYER_ID = 'wms-site-layer';

export type WmsProduct =
  | 'bref'
  | 'bvel'
  | 'cref'
  | 'neet'
  | 'pcpn'
  | 'bdhc'
  | 'boha'
  | 'bdsa';

interface Args {
  map: maplibregl.Map | null;
  styleLoaded: boolean;
  enabled: boolean;
  site: string | null; // ICAO (any case) or 'conus'
  product: WmsProduct;
  /** ISO8601 observation time for the scrubber (OpenGeo nearestValue=1). */
  time?: string | null;
  opacity?: number;
  onStatus?: (status: {
    ok: boolean;
    url: string;
    error?: string;
  }) => void;
}

const DEBOUNCE_MS = 300;

function bboxFromMap(map: maplibregl.Map) {
  const b = map.getBounds();
  return {
    bbox: metersBboxFromLngLat(
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

export function useWmsSiteLayer({
  map,
  styleLoaded,
  enabled,
  site,
  product,
  time = null,
  opacity = 0.9,
  onStatus,
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
      if (time) params.set('time', time);
      const url = `/api/radar/wms-site?${params.toString()}`;

      void fetch(url)
        .then(async (res) => {
          if (cancelled || !map) return;
          if (!res.ok) {
            onStatus?.({
              ok: false,
              url,
              error: `HTTP ${res.status}`,
            });
            return;
          }
          const blob = await res.blob();
          if (cancelled || !map) return;
          const objUrl = URL.createObjectURL(blob);
          onStatus?.({ ok: true, url });

          const existing = map.getSource(WMS_SOURCE_ID) as
            | maplibregl.ImageSource
            | undefined;
          if (existing) {
            existing.updateImage({ url: objUrl, coordinates: coords });
            return;
          }
          map.addSource(WMS_SOURCE_ID, {
            type: 'image',
            url: objUrl,
            coordinates: coords,
          });
          map.addLayer({
            id: WMS_LAYER_ID,
            type: 'raster',
            source: WMS_SOURCE_ID,
            paint: {
              'raster-opacity': opacity,
              'raster-fade-duration': 0,
              'raster-resampling': 'nearest',
            },
          });
        })
        .catch((err: unknown) => {
          onStatus?.({
            ok: false,
            url,
            error: err instanceof Error ? err.message : 'fetch failed',
          });
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
  }, [map, styleLoaded, enabled, site, product, time, opacity, onStatus]);

  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (!map.getLayer(WMS_LAYER_ID)) return;
    map.setPaintProperty(WMS_LAYER_ID, 'raster-opacity', opacity);
  }, [map, styleLoaded, opacity]);
}
