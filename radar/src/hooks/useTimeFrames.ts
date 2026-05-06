// Exposes the available scrub frames as a stable list of unix-second
// timestamps. We compute the rolling window client-side; the backend
// /api/radar/frames endpoint is just there for parity and future
// server-driven cached frames.

import { useEffect, useMemo, useState } from 'react';
import { FRAME_COUNT, FRAME_INTERVAL_MIN } from '../store/useRadarStore';
import { roundTo } from '../lib/time';

export function useTimeFrames(): number[] {
  const [now, setNow] = useState(() => roundTo(Math.floor(Date.now() / 1000), 600));

  useEffect(() => {
    const id = window.setInterval(
      () => setNow(roundTo(Math.floor(Date.now() / 1000), 600)),
      60_000,
    );
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    const frames: number[] = [];
    for (let i = FRAME_COUNT - 1; i >= 0; i--) {
      frames.push(now - i * FRAME_INTERVAL_MIN * 60);
    }
    // First entry = oldest (-60m), last entry = current (live).
    return frames;
  }, [now]);
}
