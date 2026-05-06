import { Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const WINDOW_MIN = 60;
const STEP_MIN = 5;
const STEPS = WINDOW_MIN / STEP_MIN;

interface Props {
  /** Active timestamp (unix seconds, snapped to 5-min). */
  selectedTime: number;
  onChange: (ts: number) => void;
}

export function TimeScrubber({ selectedTime, onChange }: Props) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const id = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      60_000,
    );
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!playing) {
      if (playRef.current) window.clearInterval(playRef.current);
      return;
    }
    playRef.current = window.setInterval(() => {
      const startTs = now - WINDOW_MIN * 60;
      const endTs = now;
      const next = selectedTime + STEP_MIN * 60;
      onChange(next > endTs ? startTs : next);
    }, 700);
    return () => {
      if (playRef.current) window.clearInterval(playRef.current);
    };
  }, [playing, now, selectedTime, onChange]);

  const startTs = now - WINDOW_MIN * 60;
  const isLive = now - selectedTime <= STEP_MIN * 60;

  const sliderValue = useMemo(() => {
    const clamped = Math.max(startTs, Math.min(now, selectedTime));
    return Math.round((clamped - startTs) / 60);
  }, [selectedTime, startTs, now]);

  const ticks = useMemo(
    () =>
      Array.from({ length: STEPS + 1 }, (_, i) => ({
        ts: startTs + i * STEP_MIN * 60,
      })),
    [startTs],
  );

  const labelTime = new Date(selectedTime * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="flex h-16 items-center gap-3 rounded-xl border border-white/8 bg-[rgba(15,18,23,0.92)] px-4 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setPlaying((v) => !v)}
        aria-label={playing ? 'Pause' : 'Play'}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/12 text-white hover:bg-white/22"
      >
        {playing ? (
          <Pause className="h-4 w-4" strokeWidth={2.4} />
        ) : (
          <Play className="h-4 w-4" strokeWidth={2.4} />
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-white/60">
          <span>-{WINDOW_MIN}m</span>
          <span className="font-medium text-white">{labelTime}</span>
          <button
            type="button"
            onClick={() => onChange(now)}
            className={`flex items-center gap-1 rounded-full px-2 py-[2px] font-semibold tracking-wider ${
              isLive
                ? 'bg-emerald-500/25 text-emerald-300'
                : 'bg-white/8 text-white/65 hover:bg-white/15'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isLive ? 'animate-pulse bg-emerald-400' : 'bg-white/45'
              }`}
            />
            LIVE
          </button>
        </div>
        <div className="relative h-5">
          <input
            type="range"
            min={0}
            max={WINDOW_MIN}
            step={STEP_MIN}
            value={sliderValue}
            onChange={(e) =>
              onChange(startTs + parseInt(e.target.value, 10) * 60)
            }
            className="absolute inset-0 h-full w-full appearance-none bg-transparent accent-white"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-1/2 flex -translate-y-1/2 justify-between"
          >
            {ticks.map((t) => (
              <span key={t.ts} className="block h-2 w-px bg-white/30" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
