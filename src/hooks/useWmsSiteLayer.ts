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

import type maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { metersBboxFromLngLat } from '../lib/mercator';
import {
  createRetiringUrlSlot,
  putImageLayer,
  removeImageLayer,
  type ImageCorners,
} from '../lib/imageLayer';

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
  /** Site lat/lon — when set, per-site products are pinned to the ~230 km
   *  radar footprint instead of the full map (fixes invisible velocity at
   *  CONUS zoom when stretched across the viewport). */
  siteLat?: number | null;
  siteLon?: number | null;
  /** ISO8601 observation time for the scrubber (OpenGeo nearestValue=1). */
  time?: string | null;
  opacity?: number;
  onStatus?: (status: WmsStatus) => void;
}

const DEBOUNCE_MS = 300;
const SITE_RADIUS_KM = 230;

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
    ] as ImageCorners,
  };
}

/** ~230 km radar coverage box in EPSG:3857 + MapLibre image corners. */
function bboxFromSite(lat: number, lon: number) {
  const dLat = SITE_RADIUS_KM / 111;
  const cos = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const dLon = SITE_RADIUS_KM / (111 * cos);
  const west = lon - dLon;
  const east = lon + dLon;
  const south = lat - dLat;
  const north = lat + dLat;
  return {
    bbox: metersBboxFromLngLat(west, south, east, north),
    coords: [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ] as ImageCorners,
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
  siteLat = null,
  siteLon = null,
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

  const useSiteFootprint =
    Boolean(site) &&
    site !== 'conus' &&
    typeof siteLat === 'number' &&
    typeof siteLon === 'number' &&
    Number.isFinite(siteLat) &&
    Number.isFinite(siteLon);

  // Mount / pan / product — never depends on time or opacity.
  useEffect(() => {
    if (!map || !styleLoaded) return;

    function teardown() {
      if (!map) return;
      removeImageLayer(map, WMS_SOURCE_ID, WMS_LAYER_ID);
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
    const urls = createRetiringUrlSlot();

    const apply = () => {
      if (cancelled || !map) return;
      const mySeq = ++seq;
      abort?.abort();
      abort = new AbortController();

      const { bbox, coords } =
        useSiteFootprint && siteLat != null && siteLon != null
          ? bboxFromSite(siteLat, siteLon)
          : bboxFromMap(map);
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

      // A superseded response is only worth dropping once something is
      // already painted; otherwise a pan during the fetch means the layer
      // never mounts at all.
      const stale = () => mySeq !== seq && Boolean(map?.getLayer(WMS_LAYER_ID));

      void fetch(url, { signal: abort.signal })
        .then(async (res) => {
          if (cancelled || stale() || !map) return;
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
          if (cancelled || stale() || !map) return;
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
          if (cancelled || stale() || !map) return;

          onStatusRef.current?.({ ok: true, url });
          putImageLayer(
            map,
            WMS_SOURCE_ID,
            WMS_LAYER_ID,
            urls.next(blob),
            coords,
            opacityRef.current,
          );
        })
        .catch((err: unknown) => {
          if (cancelled) return;
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
    // Site-footprint images are georeferenced — only CONUS/full-map
    // requests need a refetch on every pan.
    if (!useSiteFootprint) {
      map.on('moveend', debouncedApply);
    }

    return () => {
      cancelled = true;
      abort?.abort();
      if (timer !== undefined) window.clearTimeout(timer);
      if (!useSiteFootprint) map.off('moveend', debouncedApply);
      refreshRef.current = null;
      teardown();
      urls.dispose();
    };
  }, [
    map,
    styleLoaded,
    enabled,
    site,
    product,
    siteLat,
    siteLon,
    useSiteFootprint,
  ]);

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
