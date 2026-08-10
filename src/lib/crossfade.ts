import type maplibregl from 'maplibre-gl';

const FADE_MS = 220;

/**
 * Animate a raster layer's opacity toward `target` over ~220ms so product
 * switches and mosaic/WMS swaps feel like WeatherWise rather than a hard cut.
 */
export function fadeRasterTo(
  map: maplibregl.Map,
  layerId: string,
  target: number,
): void {
  if (!map.getLayer(layerId)) return;
  const to = Math.max(0, Math.min(1, target));
  const fromRaw = map.getPaintProperty(layerId, 'raster-opacity');
  const from =
    typeof fromRaw === 'number' && Number.isFinite(fromRaw) ? fromRaw : to;
  if (Math.abs(from - to) < 0.01) {
    map.setPaintProperty(layerId, 'raster-opacity', to);
    return;
  }

  // Cancel any in-flight fade on this layer.
  const key = `__wsFade_${layerId}`;
  const prev = (map as unknown as Record<string, number | undefined>)[key];
  if (prev !== undefined) window.cancelAnimationFrame(prev);

  const start = performance.now();
  const tick = (now: number) => {
    if (!map.getLayer(layerId)) return;
    const t = Math.min(1, (now - start) / FADE_MS);
    // ease-out
    const e = 1 - (1 - t) * (1 - t);
    map.setPaintProperty(layerId, 'raster-opacity', from + (to - from) * e);
    if (t < 1) {
      (map as unknown as Record<string, number>)[key] =
        window.requestAnimationFrame(tick);
    } else {
      delete (map as unknown as Record<string, number | undefined>)[key];
    }
  };
  (map as unknown as Record<string, number>)[key] =
    window.requestAnimationFrame(tick);
}
