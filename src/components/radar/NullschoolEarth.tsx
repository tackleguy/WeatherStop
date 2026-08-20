// Full-bleed Earth Nullschool embed for wind / temp / rain forecast.
// Deep-links into earth.nullschool.net; chrome (rail, scrubber, search)
// stays WeatherStop. Live Nullschool is proprietary — see ATTRIBUTIONS.

import { ExternalLink, Home, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  buildNullschoolUrl,
  nullschoolModeForProduct,
} from '../../lib/nullschool';
import { useRadarStore } from '../../store/useRadarStore';
import { useTimeFrames } from '../../hooks/useTimeFrames';

interface Props {
  bookmarkBar?: ReactNode;
}

export function NullschoolEarth({ bookmarkBar }: Props) {
  const activeProduct = useRadarStore((s) => s.activeProduct);
  const mapCenter = useRadarStore((s) => s.mapCenter);
  const mapZoom = useRadarStore((s) => s.mapZoom);
  const setMapCenter = useRadarStore((s) => s.setMapCenter);
  const setMapZoom = useRadarStore((s) => s.setMapZoom);
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

  const stepZoom = (delta: number) => {
    setMapZoom(Math.max(1.6, Math.min(8.5, mapZoom + delta)));
  };

  const resetView = () => {
    setMapCenter([-97, 39]);
    setMapZoom(4);
  };

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

      <div className="pointer-events-none absolute right-3 top-14 z-10 flex max-w-[min(100%-1.5rem,22rem)] flex-col items-end gap-2 sm:top-3">
        <div className="pointer-events-auto rounded-2xl px-3 py-2 floating-panel">
          <div className="flex items-center justify-end gap-2">
            <div className="mr-auto text-right">
              <p className="section-eyebrow">Earth</p>
              <p className="text-[11px] text-[var(--ink-3)]">
                Scroll or pinch to zoom, drag to rotate
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => stepZoom(0.5)}
                className="control-button h-10 w-10"
                aria-label="Zoom in Earth"
                title="Zoom in"
              >
                <Plus className="h-4 w-4" strokeWidth={1.9} />
              </button>
              <button
                type="button"
                onClick={() => stepZoom(-0.5)}
                className="control-button h-10 w-10"
                aria-label="Zoom out Earth"
                title="Zoom out"
              >
                <Minus className="h-4 w-4" strokeWidth={1.9} />
              </button>
              <button
                type="button"
                onClick={resetView}
                className="control-button h-10 w-10"
                aria-label="Reset Earth view"
                title="Reset view"
              >
                <Home className="h-4 w-4" strokeWidth={1.9} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {bookmarkBar ? (
            <div className="pointer-events-auto">{bookmarkBar}</div>
          ) : null}
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-[11px] font-medium text-[var(--ink-1)] floating-subpanel"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
            Open in Nullschool
          </a>
        </div>
        <p
          className="pointer-events-none max-w-[15rem] rounded-xl border border-white/5 px-2.5 py-1.5 text-[10px] leading-snug text-[var(--ink-3)] backdrop-blur-md"
          style={{ background: 'var(--glass)' }}
        >
          earth.nullschool.net · GFS / NOAA. Visualization © Nullschool
          Technologies.
        </p>
      </div>
    </div>
  );
}
