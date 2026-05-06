// Placeholder for SPC convective outlooks (day-1 / day-2 / day-3
// categorical and probabilistic). Wiring is a later session.

import { AlertTriangle } from 'lucide-react';

export function OutlooksView() {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center px-6 pt-20 text-center">
      <div className="rounded-2xl border border-white/10 bg-[var(--glass-hi,rgba(20,28,50,0.86))] px-8 py-10 backdrop-blur-md">
        <AlertTriangle
          className="mx-auto mb-4 h-10 w-10"
          strokeWidth={1.4}
          style={{ color: 'var(--accent, #ff8a3d)' }}
        />
        <h1 className="mb-2 text-2xl font-semibold text-white">
          SPC Convective Outlooks
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-white/65">
          Day 1 / Day 2 / Day 3 categorical risk areas (Marginal → High) and
          probabilistic tornado / hail / wind percentages. Coming soon.
        </p>
      </div>
    </div>
  );
}
