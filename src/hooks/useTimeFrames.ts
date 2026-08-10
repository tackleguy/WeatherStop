// Scrub frames for the radar timeline.
//
// Radar / satellite products: rolling past hour (5-minute steps).
// Wind / temperature / rain: Earth Nullschool (GFS) via deep-link embed.

import { useEffect, useMemo, useState } from 'react';
import {
  FORECAST_FRAME_COUNT,
  FRAME_COUNT,
  FRAME_INTERVAL_MIN,
  useRadarStore,
} from '../store/useRadarStore';
import { roundTo } from '../lib/time';
import type { ProductId } from '../constants/products';

export function isForecastProduct(product: ProductId): boolean {
  return (
    product === 'wind' ||
    product === 'temperature' ||
    product === 'rain-forecast'
  );
}

export function useTimeFrames(): number[] {
  const product = useRadarStore((s) => s.activeProduct);
  const [now, setNow] = useState(() =>
    roundTo(Math.floor(Date.now() / 1000), 600),
  );

  useEffect(() => {
    const id = window.setInterval(
      () => setNow(roundTo(Math.floor(Date.now() / 1000), 600)),
      60_000,
    );
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    if (isForecastProduct(product)) {
      // Snap to the top of the current UTC hour.
      const hourStart = Math.floor(now / 3600) * 3600;
      const frames: number[] = [];
      for (let i = 0; i < FORECAST_FRAME_COUNT; i++) {
        frames.push(hourStart + i * 3600);
      }
      return frames;
    }
    const frames: number[] = [];
    for (let i = FRAME_COUNT - 1; i >= 0; i--) {
      frames.push(now - i * FRAME_INTERVAL_MIN * 60);
    }
    return frames;
  }, [now, product]);
}
