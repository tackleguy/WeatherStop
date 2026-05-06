import { Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const WINDOW_MIN = 60; // last 60 minutes
const STEP_MIN = 5;
const STEPS = WINDOW_MIN / STEP_MIN; // 12

interface Props {
  // Active timestamp (unix seconds). Anchored to "now - WINDOW_MIN" at the
  // far-left tick, "now" at the far-right tick.
  selectedTime: number;
  onChange: (ts: number) => void;
}

export function TimeScrubber({ selectedTime, onChange }: Props) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<number | undefined>(undefined);

  // Roll the window forward every minute so "now" stays current.
  useEffect(() => {
    const id = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      60_000,
    );
    return () => window.clearInterval(id);
  }, []);

  // Auto-advance when playing; loop back to start at the end.
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

  const sliderValue = useMemo(() => {
    const clamped = Math.max(startTs, Math.min(now, selectedTime));
    return Math.round((clamped - startTs) / 60);
  }, [selectedTime, startTs, now]);

  const ticks = useMemo(
    () =>
      Array.from({ length: STEPS + 1 }, (_, i) => {
        const ts = startTs + i * STEP_MIN * 60;
        return { ts, minsAgo: WINDOW_MIN - i * STEP_MIN };
      }),
    [startTs],
  );

  const labelTime = new Date(selectedTime * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="glass flex h-16 items-center gap-3 rounded-2xl px-4">
      <button
        type="button"
        onClick={() => setPlaying((v) => !v)}
        aria-label={playing ? 'Pause' : 'Play'}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        {playing ? (
          <Pause className="h-4 w-4" strokeWidth={2.4} />
        ) : (
          <Play className="h-4 w-4" strokeWidth={2.4} />
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-white/55">
          <span>-{WINDOW_MIN}m</span>
          <span className="font-medium text-white/85">{labelTime}</span>
          <span>now</span>
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
            style={{ WebkitAppearance: 'none' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-1/2 flex -translate-y-1/2 justify-between"
          >
            {ticks.map((t) => (
              <span
                key={t.ts}
                className="block h-2 w-px bg-white/30"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
