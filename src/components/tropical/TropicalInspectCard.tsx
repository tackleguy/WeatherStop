import { X } from 'lucide-react';
import type { TropicalFeatureProps } from '../../lib/nhcTropical';

interface Props {
  feature: TropicalFeatureProps | null;
  onClose: () => void;
}

export function TropicalInspectCard({ feature, onClose }: Props) {
  if (!feature) return null;

  const entries = Object.entries(feature).filter(
    ([k, v]) =>
      !['fill', 'stroke', 'geometryKind'].includes(k) &&
      v != null &&
      String(v).length > 0 &&
      String(v).length < 200,
  );

  return (
    <div
      className="pointer-events-auto absolute bottom-4 left-3 right-3 z-20 max-w-md rounded-xl border border-[var(--line-default)] p-3 backdrop-blur-[28px] sm:left-3 sm:right-auto"
      style={{ background: 'var(--glass-hi)' }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-4)]">
            NHC feature
          </p>
          <h2 className="text-[15px] font-semibold text-[var(--ink-1)]">
            {feature.label}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>
      <dl className="max-h-40 space-y-1 overflow-y-auto text-[12px]">
        {entries.slice(0, 12).map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-24 shrink-0 text-[var(--ink-4)]">{k}</dt>
            <dd className="text-[var(--ink-2)]">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
