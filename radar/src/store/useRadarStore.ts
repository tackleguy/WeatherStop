import { create } from 'zustand';
import { DEFAULT_PRODUCT, type ProductId } from '../constants/products';

// 13 frames × 5 minutes = 60 minute rolling window. Index FRAME_COUNT-1
// is "live" (most recent frame).
export const FRAME_COUNT = 13;
export const FRAME_INTERVAL_MIN = 5;

export type PanelKey = 'alerts' | 'stations' | 'settings';

interface RadarState {
  // Layer state
  activeProduct: ProductId;
  setActiveProduct: (id: ProductId) => void;

  // Time scrubber
  currentFrameIdx: number;
  setCurrentFrameIdx: (next: number | ((prev: number) => number)) => void;
  isPlaying: boolean;
  togglePlay: () => void;

  // Map metadata
  mapZoom: number;
  setMapZoom: (z: number) => void;
  bbox: [number, number, number, number] | null; // minLon,minLat,maxLon,maxLat
  setBbox: (b: [number, number, number, number]) => void;

  // Alerts
  alertCount: number;
  setAlertCount: (n: number) => void;
  focusedAlertId: string | null;
  focusAlert: (id: string | null) => void;

  // Panel visibility
  panelsOpen: Record<PanelKey, boolean>;
  togglePanel: (key: PanelKey) => void;
  setPanelOpen: (key: PanelKey, open: boolean) => void;
}

export const useRadarStore = create<RadarState>((set, get) => ({
  activeProduct: DEFAULT_PRODUCT,
  setActiveProduct: (id) => set({ activeProduct: id }),

  currentFrameIdx: FRAME_COUNT - 1,
  setCurrentFrameIdx: (next) =>
    set((state) => ({
      currentFrameIdx:
        typeof next === 'function' ? next(state.currentFrameIdx) : next,
    })),
  isPlaying: false,
  togglePlay: () => set({ isPlaying: !get().isPlaying }),

  mapZoom: 4,
  setMapZoom: (z) => set({ mapZoom: z }),
  bbox: null,
  setBbox: (b) => set({ bbox: b }),

  alertCount: 0,
  setAlertCount: (n) => set({ alertCount: n }),
  focusedAlertId: null,
  focusAlert: (id) => set({ focusedAlertId: id }),

  panelsOpen: { alerts: true, stations: false, settings: false },
  togglePanel: (key) =>
    set((state) => ({
      panelsOpen: { ...state.panelsOpen, [key]: !state.panelsOpen[key] },
    })),
  setPanelOpen: (key, open) =>
    set((state) => ({ panelsOpen: { ...state.panelsOpen, [key]: open } })),
}));
