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

type ImageSourceLike = maplibregl.ImageSource & {
  updateImage?: (opts: { url: string; coordinates: ImageCorners }) => void;
};

/**
 * Mount or update an image source + raster layer.
 *
 * Prefer `updateImage` when the source already exists so frame refreshes
 * don't tear down the GL texture (that flash is what made radar feel
 * jumpy vs WeatherWise). Fall back to remount if coordinates change a lot
 * or updateImage isn't available.
 *
 * Do not set `raster-resampling: 'nearest'` — on ImageSource it paints a
 * solid black quad when the bitmap is minified.
 */
export function putImageLayer(
  map: maplibregl.Map,
  sourceId: string,
  layerId: string,
  url: string,
  coordinates: ImageCorners,
  opacity: number,
): void {
  const existing = map.getSource(sourceId) as ImageSourceLike | undefined;
  if (existing && typeof existing.updateImage === 'function' && map.getLayer(layerId)) {
    try {
      existing.updateImage({ url, coordinates });
      map.setPaintProperty(layerId, 'raster-opacity', clamp01(opacity));
      return;
    } catch {
      // Fall through to remount.
    }
  }

  removeImageLayer(map, sourceId, layerId);
  map.addSource(sourceId, { type: 'image', url, coordinates });
  map.addLayer({
    id: layerId,
    type: 'raster',
    source: sourceId,
    paint: {
      'raster-opacity': clamp01(opacity),
      // Short fade softens frame swaps without delaying live feel.
      'raster-fade-duration': 180,
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
