// Floating opacity slider for the active overlay. Sits just above the
// time scrubber on desktop. The store value is a multiplier the
// useRadarLayers hook applies on top of the crossfade target.

import { Sliders } from 'lucide-react';
import { useRadarStore } from '../../store/useRadarStore';

export function LayerOpacitySlider() {
  const opacity = useRadarStore((s) => s.overlayOpacity);
  const setOpacity = useRadarStore((s) => s.setOverlayOpacity);

  return (
    <div
      className="pointer-events-auto absolute right-4 top-3 z-10 flex w-44 items-center gap-2 rounded-lg border border-[var(--line-default)] px-3 py-1.5 backdrop-blur-md"
      style={{ background: 'var(--glass)' }}
    >
      <Sliders
        className="h-3.5 w-3.5 text-[var(--ink-2)]"
        strokeWidth={1.8}
      />
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={opacity}
        onChange={(e) => setOpacity(parseFloat(e.target.value))}
        className="flex-1 accent-[var(--accent)]"
        aria-label="Layer opacity"
      />
      <span
        data-num
        className="w-9 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-2)]"
      >
        {Math.round(opacity * 100)}%
      </span>
    </div>
  );
}
