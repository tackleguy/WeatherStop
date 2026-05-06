import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useRef } from 'react';
import {
  FRAME_COUNT,
  FRAME_INTERVAL_MIN,
  useRadarStore,
} from '../../store/useRadarStore';
import { useTimeFrames } from '../../hooks/useTimeFrames';
import { formatTime } from '../../lib/time';
import { PulseDot } from '../ui/PulseDot';

const PLAY_INTERVAL_MS = 600;

export function TimeScrubber() {
  const currentFrameIdx = useRadarStore((s) => s.currentFrameIdx);
  const setCurrentFrameIdx = useRadarStore((s) => s.setCurrentFrameIdx);
  const isPlaying = useRadarStore((s) => s.isPlaying);
  const togglePlay = useRadarStore((s) => s.togglePlay);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const frames = useTimeFrames();

  // Auto-advance.
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % FRAME_COUNT);
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isPlaying, setCurrentFrameIdx]);

  const isLive = currentFrameIdx === FRAME_COUNT - 1;
  const minutesAgo = (FRAME_COUNT - 1 - currentFrameIdx) * FRAME_INTERVAL_MIN;
  const currentTs = frames[currentFrameIdx];

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const r = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    setCurrentFrameIdx(Math.round(pct * (FRAME_COUNT - 1)));
  };

  const trackPct = (currentFrameIdx / (FRAME_COUNT - 1)) * 100;

  return (
    <div
      className="relative z-10 flex h-[72px] shrink-0 items-center gap-3 border-t border-[var(--line-subtle)] px-4 backdrop-blur-[28px]"
      style={{ background: 'var(--glass)' }}
    >
      <button
        type="button"
        aria-label="Skip to oldest"
        onClick={() => setCurrentFrameIdx(0)}
        className="rounded-lg p-2 text-[var(--ink-2)] hover:bg-white/5 hover:text-[var(--ink-1)]"
      >
        <SkipBack className="h-4 w-4" strokeWidth={1.6} />
      </button>

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="grid h-9 w-9 place-items-center rounded-full text-black transition-transform hover:scale-105"
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
        aria-label="Skip to live"
        onClick={() => setCurrentFrameIdx(FRAME_COUNT - 1)}
        className="rounded-lg p-2 text-[var(--ink-2)] hover:bg-white/5 hover:text-[var(--ink-1)]"
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
        <div className="h-1 rounded-full bg-white/10" />
        <div
          className="absolute left-0 top-0 h-1 rounded-full"
          style={{ width: `${trackPct}%`, background: 'var(--accent)' }}
        />

        {Array.from({ length: FRAME_COUNT }).map((_, i) => (
          <span
            key={i}
            className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-white/20"
            style={{ left: `${(i / (FRAME_COUNT - 1)) * 100}%` }}
          />
        ))}

        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
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
        style={{ minWidth: 110 }}
      >
        <span className="text-[var(--ink-3)]">{formatTime(currentTs)}</span>
        <span className="text-[var(--ink-4)]">·</span>
        {isLive ? (
          <>
            <PulseDot color="var(--sev-severe)" size={7} />
            <span className="text-[var(--ink-1)]">LIVE</span>
          </>
        ) : (
          <span className="text-[var(--ink-2)]">−{minutesAgo}m</span>
        )}
      </div>
    </div>
  );
}
