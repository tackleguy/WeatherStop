import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useRef } from 'react';
import {
  FORECAST_FRAME_COUNT,
  FRAME_COUNT,
  FRAME_INTERVAL_MIN,
  useRadarStore,
} from '../../store/useRadarStore';
import { isForecastProduct, useTimeFrames } from '../../hooks/useTimeFrames';
import { formatTime } from '../../lib/time';
import { PulseDot } from '../ui/PulseDot';

const PLAY_INTERVAL_MS = 600;
const FORECAST_PLAY_MS = 420;

export function TimeScrubber() {
  const currentFrameIdx = useRadarStore((s) => s.currentFrameIdx);
  const setCurrentFrameIdx = useRadarStore((s) => s.setCurrentFrameIdx);
  const isPlaying = useRadarStore((s) => s.isPlaying);
  const togglePlay = useRadarStore((s) => s.togglePlay);
  const activeProduct = useRadarStore((s) => s.activeProduct);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const frames = useTimeFrames();
  const forecast = isForecastProduct(activeProduct);
  const count = frames.length;
  const lastIdx = Math.max(0, count - 1);

  useEffect(() => {
    if (currentFrameIdx > lastIdx) setCurrentFrameIdx(lastIdx);
  }, [currentFrameIdx, lastIdx, setCurrentFrameIdx]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(
      () => {
        setCurrentFrameIdx((prev) => (prev + 1) % count);
      },
      forecast ? FORECAST_PLAY_MS : PLAY_INTERVAL_MS,
    );
    return () => window.clearInterval(id);
  }, [isPlaying, setCurrentFrameIdx, count, forecast]);

  const isNow = forecast
    ? currentFrameIdx === 0
    : currentFrameIdx === FRAME_COUNT - 1;
  const currentTs = frames[currentFrameIdx] ?? frames[lastIdx];
  const hoursAhead = forecast ? currentFrameIdx : 0;
  const minutesAgo = forecast
    ? 0
    : (FRAME_COUNT - 1 - currentFrameIdx) * FRAME_INTERVAL_MIN;

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current || count < 2) return;
    const r = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    setCurrentFrameIdx(Math.round(pct * lastIdx));
  };

  const trackPct = lastIdx === 0 ? 0 : (currentFrameIdx / lastIdx) * 100;
  // Show hour ticks sparsely for the 48-hour forecast track.
  const tickStep = forecast
    ? Math.max(1, Math.floor(FORECAST_FRAME_COUNT / 12))
    : 1;

  return (
    <div
      className="relative z-10 flex h-[72px] shrink-0 items-center gap-3 border-t border-[var(--line-subtle)] px-4 backdrop-blur-[28px] transition-colors duration-[var(--t-base)]"
      style={{ background: 'var(--glass)' }}
    >
      <button
        type="button"
        aria-label={forecast ? 'Jump to now' : 'Skip to oldest'}
        onClick={() => setCurrentFrameIdx(forecast ? 0 : 0)}
        className="rounded-lg p-2 text-[var(--ink-2)] transition-colors hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]"
      >
        <SkipBack className="h-4 w-4" strokeWidth={1.6} />
      </button>

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="grid h-9 w-9 place-items-center rounded-full text-white transition-transform duration-[var(--t-fast)] hover:scale-105"
        style={{
          background: 'var(--accent)',
          boxShadow: '0 0 12px var(--accent-glow)',
        }}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" strokeWidth={2.4} />
        ) : (
          <Play className="ml-0.5 h-4 w-4" strokeWidth={2.4} />
        )}
      </button>

      <button
        type="button"
        aria-label={forecast ? 'Jump to +47h' : 'Skip to live'}
        onClick={() => setCurrentFrameIdx(lastIdx)}
        className="rounded-lg p-2 text-[var(--ink-2)] transition-colors hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]"
      >
        <SkipForward className="h-4 w-4" strokeWidth={1.6} />
      </button>

      <div
        ref={trackRef}
        className="relative flex-1 cursor-pointer select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handlePointer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons) handlePointer(e);
        }}
      >
        <div
          className="h-1 rounded-full"
          style={{ background: 'var(--track)' }}
        />
        <div
          className="absolute left-0 top-0 h-1 rounded-full transition-[width] duration-[var(--t-fast)]"
          style={{ width: `${trackPct}%`, background: 'var(--accent)' }}
        />

        {Array.from({ length: count }).map((_, i) =>
          i % tickStep === 0 || i === lastIdx ? (
            <span
              key={i}
              className="absolute top-1/2 h-2.5 w-px -translate-y-1/2"
              style={{
                left: `${(i / lastIdx) * 100}%`,
                background: 'var(--track)',
              }}
            />
          ) : null,
        )}

        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white transition-[left] duration-[var(--t-fast)]"
          style={{
            left: `${trackPct}%`,
            borderColor: 'var(--accent)',
            boxShadow: '0 0 12px var(--accent-glow)',
          }}
        />
      </div>

      <div
        data-num
        className="flex shrink-0 items-center justify-end gap-2 text-[12px] font-semibold"
        style={{ minWidth: 120 }}
      >
        <span className="text-[var(--ink-3)]">{formatTime(currentTs)}</span>
        <span className="text-[var(--ink-4)]">·</span>
        {isNow ? (
          <>
            <PulseDot color="var(--sev-severe)" size={7} />
            <span className="text-[var(--ink-1)]">
              {forecast ? 'NOW' : 'LIVE'}
            </span>
          </>
        ) : forecast ? (
          <span className="text-[var(--ink-2)]">+{hoursAhead}h</span>
        ) : (
          <span className="text-[var(--ink-2)]">−{minutesAgo}m</span>
        )}
      </div>
    </div>
  );
}
