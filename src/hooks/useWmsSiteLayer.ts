// Per-site NWS WMS layer. The upstream serves a single georeferenced
// image per request, so we drive a MapLibre image source that gets
// updateImage()'d whenever the viewport settles. Debounced so a fast
// pan doesn't fire one request per pixel.
//
// All requests go through /api/radar/wms-site which hardcodes
// transparent=true + format=image/png (black-map defence).
//
// Mount/teardown only follows enabled/site/product. TIME and opacity
// never remount — remounting blanked the map on every scrubber tick.

import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';
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

export interface WmsStatus {
  ok: boolean;
  url: string;
  error?: string;
}

interface Args {
  map: maplibregl.Map | null;
  styleLoaded: boolean;
  enabled: boolean;
  site: string | null; // ICAO (any case) or 'conus'
  product: WmsProduct;
  /** ISO8601 observation time for the scrubber (OpenGeo nearestValue=1). */
  time?: string | null;
  opacity?: number;
  onStatus?: (status: WmsStatus) => void;
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

function isPngMagic(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 8) return false;
  const u = new Uint8Array(buf);
  return u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47;
}

/** Reject opaque near-black/gray frames that black out the basemap. */
async function isOpaqueJunkFrame(blob: Blob): Promise<boolean> {
  try {
    const bmp = await createImageBitmap(blob);
    const w = Math.min(48, bmp.width);
    const h = Math.min(48, bmp.height);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const { data } = ctx.getImageData(0, 0, w, h);
    const total = w * h;
    let opaque = 0;
    let junk = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 20) continue;
      opaque++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      // Near-black or flat gray (low chroma) — the gray rectangle bug.
      if (max < 55 || (max - min < 12 && max < 140)) junk++;
    }
    if (opaque / total < 0.75) return false;
    return junk / opaque > 0.92;
  } catch {
    return false;
  }
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
  const timeRef = useRef(time);
  timeRef.current = time;
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const refreshRef = useRef<(() => void) | null>(null);

  // Mount / pan / product — never depends on time or opacity.
  useEffect(() => {
    if (!map || !styleLoaded) return;

    function teardown() {
      if (!map) return;
      if (map.getLayer(WMS_LAYER_ID)) map.removeLayer(WMS_LAYER_ID);
      if (map.getSource(WMS_SOURCE_ID)) map.removeSource(WMS_SOURCE_ID);
    }

    if (!enabled || !site) {
      teardown();
      refreshRef.current = null;
      return;
    }

    let timer: number | undefined;
    let cancelled = false;
    let seq = 0;
    let abort: AbortController | null = null;
    let lastObjUrl: string | null = null;

    const apply = () => {
      if (cancelled || !map) return;
      const mySeq = ++seq;
      abort?.abort();
      abort = new AbortController();

      const { bbox, coords } = bboxFromMap(map);
      const params = new URLSearchParams({
        site,
        product,
        bbox,
        width: '1024',
        height: '1024',
      });
      const t = timeRef.current;
      if (t) params.set('time', t);
      const url = `/api/radar/wms-site?${params.toString()}`;

      void fetch(url, { signal: abort.signal })
        .then(async (res) => {
          if (cancelled || mySeq !== seq || !map) return;
          if (!res.ok) {
            onStatusRef.current?.({
              ok: false,
              url,
              error: `HTTP ${res.status}`,
            });
            // Keep last good image — do not teardown.
            return;
          }
          const buf = await res.arrayBuffer();
          if (cancelled || mySeq !== seq || !map) return;
          if (!isPngMagic(buf)) {
            onStatusRef.current?.({
              ok: false,
              url,
              error: 'not a PNG (upstream exception?)',
            });
            return;
          }
          const blob = new Blob([buf], { type: 'image/png' });
          if (await isOpaqueJunkFrame(blob)) {
            onStatusRef.current?.({
              ok: false,
              url,
              error: 'opaque blank/gray frame',
            });
            return;
          }
          if (cancelled || mySeq !== seq || !map) return;

          const objUrl = URL.createObjectURL(blob);
          if (lastObjUrl) URL.revokeObjectURL(lastObjUrl);
          lastObjUrl = objUrl;
          onStatusRef.current?.({ ok: true, url });

          const existing = map.getSource(WMS_SOURCE_ID) as
            | maplibregl.ImageSource
            | undefined;
          if (existing) {
            existing.updateImage({ url: objUrl, coordinates: coords });
            if (map.getLayer(WMS_LAYER_ID)) {
              map.setPaintProperty(
                WMS_LAYER_ID,
                'raster-opacity',
                opacityRef.current,
              );
            }
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
              'raster-opacity': opacityRef.current,
              'raster-fade-duration': 0,
              'raster-resampling': 'nearest',
            },
          });
        })
        .catch((err: unknown) => {
          if (cancelled || mySeq !== seq) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          onStatusRef.current?.({
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

    refreshRef.current = apply;
    apply();
    map.on('moveend', debouncedApply);

    return () => {
      cancelled = true;
      abort?.abort();
      if (timer !== undefined) window.clearTimeout(timer);
      map.off('moveend', debouncedApply);
      refreshRef.current = null;
      teardown();
      if (lastObjUrl) URL.revokeObjectURL(lastObjUrl);
    };
  }, [map, styleLoaded, enabled, site, product]);

  // TIME change → in-place refetch (no remount).
  useEffect(() => {
    if (!enabled || !site) return;
    refreshRef.current?.();
  }, [time, enabled, site, product]);

  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (!map.getLayer(WMS_LAYER_ID)) return;
    map.setPaintProperty(WMS_LAYER_ID, 'raster-opacity', opacity);
  }, [map, styleLoaded, opacity]);
}
