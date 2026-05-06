// Placeholder for GFS/HRRR ensemble forecast products. Wiring lands in a
// later session — this just renders a "coming soon" card so the route
// resolves cleanly.

import { LineChart } from 'lucide-react';

export function ModelsView() {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center px-6 pt-20 text-center">
      <div className="rounded-2xl border border-white/10 bg-[var(--glass-hi,rgba(20,28,50,0.86))] px-8 py-10 backdrop-blur-md">
        <LineChart
          className="mx-auto mb-4 h-10 w-10"
          strokeWidth={1.4}
          style={{ color: 'var(--accent, #ff8a3d)' }}
        />
        <h1 className="mb-2 text-2xl font-semibold text-white">
          Forecast Models
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-white/65">
          GFS, HRRR, and ECMWF ensemble products will land here — temperature,
          precipitation, and wind forecasts from each major model with a
          run-time picker and a 60-hour scrubber. Coming soon.
        </p>
      </div>
    </div>
  );
}
