import { lazy, Suspense, useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { SideNav } from './components/shell/SideNav';
import { InstallPrompt } from './components/InstallPrompt';
import { ThemeBoot } from './components/ThemeBoot';
import { HomeView } from './routes/HomeView';
import { MapProductRedirect } from './routes/MapProductRedirect';
import { applyTheme, loadTheme } from './lib/theme';
import { isGolfHost } from './lib/golfApp';

// Apply theme before first paint of lazy routes.
applyTheme(loadTheme());

const RadarView = lazy(() =>
  import('./routes/RadarView').then((m) => ({ default: m.RadarView })),
);
const ModelsView = lazy(() =>
  import('./routes/ModelsView').then((m) => ({ default: m.ModelsView })),
);
const OutlooksView = lazy(() =>
  import('./routes/OutlooksView').then((m) => ({ default: m.OutlooksView })),
);
const ForecastView = lazy(() =>
  import('./routes/ForecastView').then((m) => ({ default: m.ForecastView })),
);
const AlertsView = lazy(() =>
  import('./routes/AlertsView').then((m) => ({ default: m.AlertsView })),
);
const CitiesView = lazy(() =>
  import('./routes/CitiesView').then((m) => ({ default: m.CitiesView })),
);
const SettingsView = lazy(() =>
  import('./routes/SettingsView').then((m) => ({ default: m.SettingsView })),
);
const SearchView = lazy(() =>
  import('./routes/SearchView').then((m) => ({ default: m.SearchView })),
);
const CompareView = lazy(() =>
  import('./routes/CompareView').then((m) => ({ default: m.CompareView })),
);
const DashboardView = lazy(() =>
  import('./routes/DashboardView').then((m) => ({ default: m.DashboardView })),
);
const TropicalView = lazy(() =>
  import('./routes/TropicalView').then((m) => ({ default: m.TropicalView })),
);
const StormView = lazy(() =>
  import('./routes/StormView').then((m) => ({ default: m.StormView })),
);
const GolfView = lazy(() =>
  import('./routes/GolfView').then((m) => ({ default: m.GolfView })),
);

function RouteFallback() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'var(--surface-0)' }}
      aria-busy="true"
      aria-label="Loading"
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
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const loc = useLocation();
  const golfHost = isGolfHost();
  const golfSolo =
    golfHost || loc.pathname === '/golf' || loc.pathname.startsWith('/golf/');

  useEffect(() => {
    if (!golfSolo) {
      document.title = 'WeatherStop';
      return;
    }
    document.title = 'WeatherStop Golf';
    const manifest = document.querySelector('link[rel="manifest"]');
    const prev = manifest?.getAttribute('href');
    manifest?.setAttribute('href', '/golf-manifest.webmanifest');
    return () => {
      document.title = 'WeatherStop';
      if (manifest && prev) manifest.setAttribute('href', prev);
    };
  }, [golfSolo]);

  if (golfHost) {
    return (
      <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-deep)] transition-colors duration-[var(--t-base)]">
        <ThemeBoot />
        <div className="app-main golf-solo">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<GolfView />} />
              <Route path="/golf" element={<GolfView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
        <InstallPrompt />
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-deep)] transition-colors duration-[var(--t-base)]">
      <ThemeBoot />
      {golfSolo ? null : <SideNav />}
      <div className={golfSolo ? 'app-main golf-solo' : 'app-main'}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/city/:cityId" element={<HomeView />} />
            <Route path="/radar" element={<RadarView />} />
            <Route path="/map" element={<Navigate to="/radar" replace />} />
            <Route
              path="/wind"
              element={<MapProductRedirect product="wind" to="/radar" />}
            />
            <Route
              path="/temperature"
              element={
                <MapProductRedirect product="temperature" to="/radar" />
              }
            />
            <Route
              path="/rain"
              element={
                <MapProductRedirect product="rain-forecast" to="/radar" />
              }
            />
            <Route
              path="/satellite"
              element={
                <MapProductRedirect product="satellite-ir" to="/radar" />
              }
            />
            <Route
              path="/composite"
              element={<MapProductRedirect product="composite" to="/radar" />}
            />
            <Route path="/forecast" element={<ForecastView />} />
            <Route path="/alerts" element={<AlertsView />} />
            <Route path="/outlooks" element={<OutlooksView />} />
            <Route path="/tropical" element={<TropicalView />} />
            <Route path="/storm" element={<StormView />} />
            <Route path="/models" element={<ModelsView />} />
            <Route path="/golf" element={<GolfView />} />
            <Route path="/cities" element={<CitiesView />} />
            <Route path="/compare" element={<CompareView />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/search" element={<SearchView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
      <InstallPrompt />
    </div>
  );
}
