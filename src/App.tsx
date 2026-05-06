import { lazy, Suspense } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { PillNav } from './components/shell/PillNav';
import { InstallPrompt } from './components/InstallPrompt';
import { HomeView } from './routes/HomeView';

// Map-driven routes pull in maplibre-gl (~800 KB). Lazy-load so the
// home view's initial JS payload stays small. The Suspense fallback
// is a near-blank dark screen so the route swap still feels fast.
const RadarView = lazy(() =>
  import('./routes/RadarView').then((m) => ({ default: m.RadarView })),
);
const CompositeView = lazy(() =>
  import('./routes/CompositeView').then((m) => ({ default: m.CompositeView })),
);
const SatelliteView = lazy(() =>
  import('./routes/SatelliteView').then((m) => ({ default: m.SatelliteView })),
);
const ModelsView = lazy(() =>
  import('./routes/ModelsView').then((m) => ({ default: m.ModelsView })),
);
const OutlooksView = lazy(() =>
  import('./routes/OutlooksView').then((m) => ({ default: m.OutlooksView })),
);

function MapRouteFallback() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'var(--surface-0,#060912)' }}
      aria-busy="true"
      aria-label="Loading map"
    >
      <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/3 animate-[shimmer_1.6s_linear_infinite] bg-white/40" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-deep,#0a0d12)]">
        <Suspense fallback={<MapRouteFallback />}>
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/city/:cityId" element={<HomeView />} />
            <Route path="/radar" element={<RadarView />} />
            <Route path="/composite" element={<CompositeView />} />
            <Route path="/satellite" element={<SatelliteView />} />
            <Route path="/models" element={<ModelsView />} />
            <Route path="/outlooks" element={<OutlooksView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>

        <PillNav />
        <InstallPrompt />
      </div>
    </BrowserRouter>
  );
}
