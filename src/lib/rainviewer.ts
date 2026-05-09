// RainViewer tile source — keyless, public, free. We use it for both
// the radar overlay (composite reflectivity, worldwide) and the
// satellite overlay (infrared GOES/EUMETSAT mosaic).
//
// API:
//   https://api.rainviewer.com/public/weather-maps.json
// returns the current frame catalog:
//   { host, radar: { past: [], nowcast: [] }, satellite: { infrared: [] } }
//
// Each frame is { time, path }. Tiles are at:
//   {host}{path}/{size}/{z}/{x}/{y}/{color}/{options}.png
//
//   size:    256 or 512 (we use 256)
//   color:   2 = Universal Blue (default), 6 = NEXRAD Level III
//   options: "{smooth}_{snow}" — 0 or 1 each. We use "1_1".

export interface RainViewerFrame {
  time: number; // epoch seconds
  path: string;
}

export interface RainViewerCatalog {
  host: string;
  radarPast: RainViewerFrame[];
  radarNowcast: RainViewerFrame[];
  satelliteInfrared: RainViewerFrame[];
  generatedAt: number;
}

interface RawCatalog {
  version: string;
  generated: number;
  host: string;
  radar?: {
    past?: RainViewerFrame[];
    nowcast?: RainViewerFrame[];
  };
  satellite?: {
    infrared?: RainViewerFrame[];
  };
}

const ENDPOINT = 'https://api.rainviewer.com/public/weather-maps.json';

export async function fetchRainViewerCatalog(
  signal?: AbortSignal,
): Promise<RainViewerCatalog> {
  const res = await fetch(ENDPOINT, { signal });
  if (!res.ok) throw new Error(`RainViewer ${res.status}`);
  const json = (await res.json()) as RawCatalog;
  return {
    host: json.host,
    radarPast: json.radar?.past ?? [],
    radarNowcast: json.radar?.nowcast ?? [],
    satelliteInfrared: json.satellite?.infrared ?? [],
    generatedAt: json.generated,
  };
}

export type RainViewerKind = 'radar' | 'satellite';
// 0 = "no recoloring" (used for satellite IR grayscale); 1..8 are
// RainViewer's named radar palettes.
export type RainViewerColor = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface BuildOpts {
  catalog: RainViewerCatalog;
  kind: RainViewerKind;
  /** Frame index into the merged frame list (past + nowcast for radar). */
  frameIndex: number;
  color?: RainViewerColor;
  smooth?: 0 | 1;
  snow?: 0 | 1;
}

// Returns the merged frame list a consumer should hand to MapLibre's tile
// scrubber. For radar we concatenate past + nowcast so the scrubber
// extends into the future; for satellite we use infrared only.
export function getFrames(
  catalog: RainViewerCatalog,
  kind: RainViewerKind,
): RainViewerFrame[] {
  if (kind === 'radar') {
    return [...catalog.radarPast, ...catalog.radarNowcast];
  }
  return catalog.satelliteInfrared;
}

export function buildTileUrl(opts: BuildOpts): string {
  const frames = getFrames(opts.catalog, opts.kind);
  const idx = Math.max(0, Math.min(frames.length - 1, opts.frameIndex));
  const frame = frames[idx];
  if (!frame) {
    // Defensive — return a 1x1 transparent pixel URL pattern that will
    // 404 cleanly rather than break MapLibre's tile loader.
    return `${opts.catalog.host}/v2/coverage/0/256/{z}/{x}/{y}/2/1_1.png`;
  }
  // RainViewer color codes are scoped to the *kind* — palette 7 is a
  // radar-only palette (Rainbow @ SELEX-IS) and produces 404s when
  // requested against a satellite tile path. Default radar to 7
  // (sharp, NWS-ish) and satellite to 0 (no recoloring, IR grayscale).
  const color = opts.color ?? (opts.kind === 'radar' ? 7 : 0);
  const smooth = opts.smooth ?? 1;
  const snow = opts.snow ?? 1;
  return `${opts.catalog.host}${frame.path}/256/{z}/{x}/{y}/${color}/${smooth}_${snow}.png`;
}

// Pick the frame whose timestamp is closest to `targetSec` (epoch seconds).
// Used by the orchestrator so each source can independently align its
// tile URL with the time-scrubber position.
export function pickFrameIndex(
  catalog: RainViewerCatalog,
  kind: RainViewerKind,
  targetSec: number,
): number {
  const list = getFrames(catalog, kind);
  if (list.length === 0) return 0;
  let bestIdx = list.length - 1;
  let bestDiff = Infinity;
  for (let i = 0; i < list.length; i++) {
    const d = Math.abs(list[i].time - targetSec);
    if (d < bestDiff) {
      bestDiff = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Fallback URL for an empty catalog (boot-time, before the fetch lands).
// MapLibre needs a URL to register the source; we hand it a coverage tile
// which is always valid and renders as light grey.
export function placeholderTileUrl(host = 'https://tilecache.rainviewer.com'): string {
  return `${host}/v2/coverage/0/256/{z}/{x}/{y}/2/1_1.png`;
}
