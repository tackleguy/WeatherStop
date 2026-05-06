import { create } from 'zustand';
import { DEFAULT_PRODUCT, type ProductId } from '../constants/products';
import type { NexradSite } from '../lib/nexradSites';

// Mirror of the SourcePlan that RadarMap pushes from useRadarLayers.
// Stored as plain primitives so other components (LayerInfoChip,
// FocusedSiteChip) can subscribe selectively without re-rendering on
// every plan churn.
export interface ActiveSourcePlan {
  kind: string;
  label: string;
  attribution: string;
  siteId: string | null;
  siteName: string | null;
  siteState: string | null;
}

// 13 frames × 5 minutes = 60 minute rolling window. Index FRAME_COUNT-1
// is "live" (most recent frame).
export const FRAME_COUNT = 13;
export const FRAME_INTERVAL_MIN = 5;

export type PanelKey =
  | 'alerts'
  | 'stations'
  | 'settings'
  | 'bookmarks'
  | 'ruler';

export type AlertCategory =
  | 'tornado'
  | 'severe-thunderstorm'
  | 'flash-flood'
  | 'winter'
  | 'special'
  | 'other';

export interface BookmarkView {
  id: string;
  name: string;
  center: [number, number]; // lon, lat
  zoom: number;
  product: ProductId;
  createdAt: number;
}

const BOOKMARK_KEY = 'wsr-bookmarks-v1';
const ALERT_FILTER_KEY = 'wsr-alert-filter-v1';
const OPACITY_KEY = 'wsr-overlay-opacity-v1';

function loadBookmarks(): BookmarkView[] {
  try {
    const raw = globalThis.localStorage?.getItem(BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BookmarkView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBookmarks(items: BookmarkView[]): void {
  try {
    globalThis.localStorage?.setItem(BOOKMARK_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function loadAlertFilter(): Set<AlertCategory> {
  try {
    const raw = globalThis.localStorage?.getItem(ALERT_FILTER_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as AlertCategory[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveAlertFilter(filter: Set<AlertCategory>): void {
  try {
    globalThis.localStorage?.setItem(
      ALERT_FILTER_KEY,
      JSON.stringify(Array.from(filter)),
    );
  } catch {
    // ignore
  }
}

function loadOpacity(): number {
  try {
    const raw = globalThis.localStorage?.getItem(OPACITY_KEY);
    if (raw === null || raw === undefined) return 0.85;
    const v = parseFloat(raw);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.85;
  } catch {
    return 0.85;
  }
}

function saveOpacity(value: number): void {
  try {
    globalThis.localStorage?.setItem(OPACITY_KEY, String(value));
  } catch {
    // ignore
  }
}

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
  bbox: [number, number, number, number] | null;
  setBbox: (b: [number, number, number, number]) => void;
  mapCenter: [number, number] | null;
  setMapCenter: (c: [number, number]) => void;

  // Alerts
  alertCount: number;
  setAlertCount: (n: number) => void;
  focusedAlertId: string | null;
  focusAlert: (id: string | null) => void;
  /** When non-empty, only alerts in this set are shown. Empty = show all. */
  alertFilter: Set<AlertCategory>;
  toggleAlertCategory: (cat: AlertCategory) => void;
  clearAlertFilter: () => void;

  // Layer opacity (user override on top of crossfade target)
  overlayOpacity: number;
  setOverlayOpacity: (v: number) => void;

  // Bookmarks
  bookmarks: BookmarkView[];
  addBookmark: (b: BookmarkView) => void;
  removeBookmark: (id: string) => void;

  // Distance ruler
  rulerActive: boolean;
  setRulerActive: (active: boolean) => void;
  rulerPoints: Array<[number, number]>;
  pushRulerPoint: (p: [number, number]) => void;
  clearRuler: () => void;

  // Click inspector
  inspectAt: [number, number] | null;
  setInspectAt: (p: [number, number] | null) => void;

  // Active radar source (mirrored from useRadarLayers' resolver) + the
  // user's manual site override (when set, the resolver locks the per-
  // site WMS to this station instead of the auto-nearest pick).
  sourcePlan: ActiveSourcePlan | null;
  setSourcePlan: (plan: ActiveSourcePlan) => void;
  manualSite: NexradSite | null;
  setManualSite: (site: NexradSite | null) => void;

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
  mapCenter: null,
  setMapCenter: (c) => set({ mapCenter: c }),

  alertCount: 0,
  setAlertCount: (n) => set({ alertCount: n }),
  focusedAlertId: null,
  focusAlert: (id) => set({ focusedAlertId: id }),
  alertFilter: loadAlertFilter(),
  toggleAlertCategory: (cat) =>
    set((state) => {
      const next = new Set(state.alertFilter);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      saveAlertFilter(next);
      return { alertFilter: next };
    }),
  clearAlertFilter: () =>
    set(() => {
      saveAlertFilter(new Set());
      return { alertFilter: new Set() };
    }),

  overlayOpacity: loadOpacity(),
  setOverlayOpacity: (v) =>
    set(() => {
      saveOpacity(v);
      return { overlayOpacity: v };
    }),

  bookmarks: loadBookmarks(),
  addBookmark: (b) =>
    set((state) => {
      const next = [b, ...state.bookmarks].slice(0, 24);
      saveBookmarks(next);
      return { bookmarks: next };
    }),
  removeBookmark: (id) =>
    set((state) => {
      const next = state.bookmarks.filter((b) => b.id !== id);
      saveBookmarks(next);
      return { bookmarks: next };
    }),

  rulerActive: false,
  setRulerActive: (active) =>
    set(() => ({
      rulerActive: active,
      ...(active ? {} : { rulerPoints: [] }),
    })),
  rulerPoints: [],
  pushRulerPoint: (p) =>
    set((state) => {
      // After two points the next click resets to single-point.
      if (state.rulerPoints.length >= 2) return { rulerPoints: [p] };
      return { rulerPoints: [...state.rulerPoints, p] };
    }),
  clearRuler: () => set({ rulerPoints: [] }),

  inspectAt: null,
  setInspectAt: (p) => set({ inspectAt: p }),

  sourcePlan: null,
  setSourcePlan: (plan) =>
    set((state) => {
      const prev = state.sourcePlan;
      if (
        prev &&
        prev.kind === plan.kind &&
        prev.label === plan.label &&
        prev.siteId === plan.siteId
      ) {
        return state;
      }
      return { sourcePlan: plan };
    }),
  manualSite: null,
  setManualSite: (site) => set({ manualSite: site }),

  panelsOpen: {
    alerts: true,
    stations: false,
    settings: false,
    bookmarks: false,
    ruler: false,
  },
  togglePanel: (key) =>
    set((state) => ({
      panelsOpen: { ...state.panelsOpen, [key]: !state.panelsOpen[key] },
    })),
  setPanelOpen: (key, open) =>
    set((state) => ({ panelsOpen: { ...state.panelsOpen, [key]: open } })),
}));

// Categorize an alert event name into one of our filter buckets. Used by
// AlertFilterChips and the GeoJSON filter expression in RadarMap.
export function categorizeAlertEvent(event: string): AlertCategory {
  const e = event.toLowerCase();
  if (e.includes('tornado')) return 'tornado';
  if (e.includes('thunderstorm') || e.includes('severe storm'))
    return 'severe-thunderstorm';
  if (e.includes('flash flood') || e.includes('flood')) return 'flash-flood';
  if (
    e.includes('winter') ||
    e.includes('snow') ||
    e.includes('blizzard') ||
    e.includes('ice')
  )
    return 'winter';
  if (e.includes('special weather')) return 'special';
  return 'other';
}
