// Progress chip for the slow overlays. CONUS mosaics take 1.5-4 s to
// render server-side and a Level 2 sweep can take longer; without any
// feedback that window is indistinguishable from a broken layer.

import { Loader2 } from 'lucide-react';
import { useRadarStore } from '../../store/useRadarStore';

export function LayerLoadingChip() {
  const label = useRadarStore((s) => s.layerLoading);
  if (!label) return null;

  return (
    <div
      className="pointer-events-none flex items-center gap-2 rounded-lg border border-[var(--line-default)] px-3 py-1.5 backdrop-blur-md"
      style={{ background: 'var(--glass)' }}
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="h-3.5 w-3.5 animate-spin text-[var(--accent,#ff8a3d)]"
        strokeWidth={2.2}
      />
      <span className="text-[11px] font-medium text-[var(--ink-2)]">
        Loading {label}…
      </span>
    </div>
  );
}
