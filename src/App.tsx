import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { PillNav } from './components/shell/PillNav';
import { InstallPrompt } from './components/InstallPrompt';
import { CompositeView } from './routes/CompositeView';
import { HomeView } from './routes/HomeView';
import { ModelsView } from './routes/ModelsView';
import { OutlooksView } from './routes/OutlooksView';
import { RadarView } from './routes/RadarView';
import { SatelliteView } from './routes/SatelliteView';

export default function App() {
  return (
    <BrowserRouter>
      <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-deep,#0a0d12)]">
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

        <PillNav />
        <InstallPrompt />
      </div>
    </BrowserRouter>
  );
}
