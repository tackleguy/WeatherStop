// Mounting helpers for MapLibre image sources (mosaic / WMS / Level 2 /
// Level 3 / DWD).

import type maplibregl from 'maplibre-gl';

export type ImageCorners = [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
];

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Mount an image source and its raster layer, replacing any previous one.
 *
 * Do not add `raster-resampling: 'nearest'` here. The tile products use it to
 * keep radar pixels crisp, but on an image source it makes the layer paint a
 * solid opaque black quad across the whole footprint the moment the image is
 * minified — which it always is, since these are 1024² frames drawn into a
 * smaller viewport. That is what turned the map black for every image-backed
 * product; the source itself gives no hint of trouble, because the decoded
 * bitmap and the GL texture are both fine.
 *
 * The source is rebuilt rather than updated through `updateImage` so that a
 * moved footprint or a second frame arriving mid-download cannot interleave
 * with a load already in flight. Refreshes carry a blob that is already in
 * memory, so the rebuild costs a frame at most.
 */
export function putImageLayer(
  map: maplibregl.Map,
  sourceId: string,
  layerId: string,
  url: string,
  coordinates: ImageCorners,
  opacity: number,
): void {
  removeImageLayer(map, sourceId, layerId);
  map.addSource(sourceId, { type: 'image', url, coordinates });
  map.addLayer({
    id: layerId,
    type: 'raster',
    source: sourceId,
    paint: {
      'raster-opacity': clamp01(opacity),
      'raster-fade-duration': 0,
    },
  });
}

export function removeImageLayer(
  map: maplibregl.Map,
  sourceId: string,
  layerId: string,
): void {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

export interface RetiringUrlSlot {
  /** Object URL for `blob`, keeping the previous one alive briefly. */
  next: (blob: Blob) => string;
  dispose: () => void;
}

/**
 * Object URLs handed to an image source have to outlive MapLibre's async
 * decode. Revoking the previous URL the instant a new one arrived raced
 * that decode and left the source pointing at a dead blob, so retire
 * superseded URLs on a delay instead.
 */
export function createRetiringUrlSlot(graceMs = 15_000): RetiringUrlSlot {
  let current: string | null = null;
  const timers = new Set<number>();

  return {
    next(blob: Blob): string {
      const url = URL.createObjectURL(blob);
      const superseded = current;
      current = url;
      if (superseded) {
        const timer = window.setTimeout(() => {
          URL.revokeObjectURL(superseded);
          timers.delete(timer);
        }, graceMs);
        timers.add(timer);
      }
      return url;
    },
    dispose(): void {
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      if (current) URL.revokeObjectURL(current);
      current = null;
    },
  };
}
