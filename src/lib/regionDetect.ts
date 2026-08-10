// Coarse region classifier used by the source resolver to decide which
// upstream radar / satellite tile service to mount. The boxes are
// intentionally generous so coastal panning doesn't flip the source on
// every move — see sourceResolver for the per-product fallback chain
// when a region returns nothing useful.

export type Region =
  | 'US-CONUS'
  | 'US-AK'
  | 'US-HI'
  | 'EU-DE'
  | 'EU'
  | 'INTL';

interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}

const CONUS_BOX: Box = { west: -130, south: 24, east: -65, north: 50 };

export function detectRegion(lng: number, lat: number): Region {
  if (lng >= -130 && lng <= -65 && lat >= 24 && lat <= 50) return 'US-CONUS';
  if (lng >= -180 && lng <= -130 && lat >= 50 && lat <= 72) return 'US-AK';
  if (lng >= -162 && lng <= -153 && lat >= 18 && lat <= 23) return 'US-HI';
  if (lng >= 5.5 && lng <= 15.5 && lat >= 47 && lat <= 55.5) return 'EU-DE';
  if (lng >= -12 && lng <= 35 && lat >= 34 && lat <= 72) return 'EU';
  return 'INTL';
}

export function isUS(r: Region): boolean {
  return r === 'US-CONUS' || r === 'US-AK' || r === 'US-HI';
}

/** Share of `view` that also lies inside `box`, 0..1. */
function overlapFraction(view: Box, box: Box): number {
  const west = Math.max(view.west, box.west);
  const east = Math.min(view.east, box.east);
  const south = Math.max(view.south, box.south);
  const north = Math.min(view.north, box.north);
  if (east <= west || north <= south) return 0;
  const viewArea = (view.east - view.west) * (view.north - view.south);
  if (viewArea <= 0) return 0;
  return ((east - west) * (north - south)) / viewArea;
}

/** Enough of the viewport is CONUS that US-only products are worth showing. */
const CONUS_VIEW_SHARE = 0.15;

/**
 * Classify the region for the current viewport rather than a single point.
 *
 * The centre point alone is misleading at continental zoom: panning so
 * that the centre lands in southern Canada or the Gulf reported every
 * US-only product as "Unavailable in this region" while CONUS still
 * filled most of the screen. Only CONUS gets the viewport treatment —
 * the German and Alaskan ladders only engage at zoom levels where the
 * centre point is already a reliable signal.
 */
export function detectRegionForViewport(
  lng: number,
  lat: number,
  bbox: [number, number, number, number] | null | undefined,
): Region {
  const centre = detectRegion(lng, lat);
  if (isUS(centre) || !bbox) return centre;

  const [west, south, east, north] = bbox;
  if (![west, south, east, north].every(Number.isFinite)) return centre;
  const view: Box = {
    west: Math.max(-180, Math.min(west, east)),
    east: Math.min(180, Math.max(west, east)),
    south: Math.max(-85, Math.min(south, north)),
    north: Math.min(85, Math.max(south, north)),
  };

  if (overlapFraction(view, CONUS_BOX) >= CONUS_VIEW_SHARE) return 'US-CONUS';
  return centre;
}
