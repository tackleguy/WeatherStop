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
