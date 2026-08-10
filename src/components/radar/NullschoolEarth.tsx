// Full-bleed Earth Nullschool embed for wind / temp / rain forecast.
// Deep-links into earth.nullschool.net; chrome (rail, scrubber, search)
// stays WeatherStop. Live Nullschool is proprietary — see ATTRIBUTIONS.

import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  buildNullschoolUrl,
  nullschoolModeForProduct,
} from '../../lib/nullschool';
import { useRadarStore } from '../../store/useRadarStore';
import { useTimeFrames } from '../../hooks/useTimeFrames';

export function NullschoolEarth() {
  const activeProduct = useRadarStore((s) => s.activeProduct);
  const mapCenter = useRadarStore((s) => s.mapCenter);
  const mapZoom = useRadarStore((s) => s.mapZoom);
  const currentFrameIdx = useRadarStore((s) => s.currentFrameIdx);
  const frames = useTimeFrames();
  const mode = nullschoolModeForProduct(activeProduct);

  const lon = mapCenter?.[0] ?? -97;
  const lat = mapCenter?.[1] ?? 39;
  const unixSec = frames[currentFrameIdx] ?? Math.floor(Date.now() / 1000);

  const targetUrl = useMemo(() => {
    if (!mode) return null;
    return buildNullschoolUrl({
      mode,
      lon,
      lat,
      zoom: mapZoom,
      unixSec,
    });
  }, [mode, lon, lat, mapZoom, unixSec]);

  // Debounce src so scrubbing doesn't thrash the iframe every tick.
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!targetUrl) {
      setSrc(null);
      return;
    }
    const id = window.setTimeout(() => setSrc(targetUrl), 280);
    return () => window.clearTimeout(id);
  }, [targetUrl]);

  if (!mode || !src) return null;

  return (
    <div className="absolute inset-0 z-[5] overflow-hidden bg-[var(--bg-deep)]">
      <iframe
        title="Earth Nullschool weather"
        src={src}
        className="absolute inset-0 h-full w-full border-0"
        // Nullschool needs scripts + same-origin-ish freedom for WebGL.
        allow="fullscreen; accelerometer; gyroscope"
        referrerPolicy="no-referrer-when-downgrade"
      />

      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-2 sm:left-auto sm:right-3">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[var(--ink-1)] shadow-lg ring-1 ring-white/10 backdrop-blur-md"
          style={{ background: 'var(--glass-hi)' }}
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
          Open in Nullschool
        </a>
        <p
          className="pointer-events-none max-w-[14rem] rounded-md px-2 py-1 text-[10px] leading-snug text-[var(--ink-3)] ring-1 ring-white/5 backdrop-blur-md"
          style={{ background: 'var(--glass)' }}
        >
          earth.nullschool.net · GFS / NOAA. Visualization © Nullschool
          Technologies.
        </p>
      </div>
    </div>
  );
}
