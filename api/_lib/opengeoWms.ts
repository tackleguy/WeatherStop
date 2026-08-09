// Single factory for OpenGeo / NWS GeoServer GetMap URLs.
// ALWAYS sets transparent=true + format=image/png — omitting either
// returns opaque black tiles that cover the whole map.

export type OpenGeoSiteProduct =
  | 'bref'
  | 'bvel'
  | 'bdhc'
  | 'boha'
  | 'bdsa';

export type OpenGeoConusProduct =
  | 'bref'
  | 'cref'
  | 'neet'
  | 'pcpn';

const SITE_SUFFIX: Record<OpenGeoSiteProduct, string> = {
  bref: 'sr_bref',
  bvel: 'sr_bvel',
  bdhc: 'bdhc',
  boha: 'boha',
  bdsa: 'bdsa',
};

const CONUS_LAYER: Record<OpenGeoConusProduct, string> = {
  bref: 'conus:conus_bref_qcd',
  cref: 'conus:conus_cref_qcd',
  neet: 'conus:conus_neet_v18',
  pcpn: 'conus:conus_pcpn_typ',
};

export function resolveOpenGeoLayer(
  site: string,
  product: string,
): string | null {
  const s = site.toLowerCase();
  if (s === 'conus') {
    if (!(product in CONUS_LAYER)) return null;
    return CONUS_LAYER[product as OpenGeoConusProduct];
  }
  if (!/^[a-z]{4}$/.test(s)) return null;
  if (!(product in SITE_SUFFIX)) return null;
  const suffix = SITE_SUFFIX[product as OpenGeoSiteProduct];
  return `${s}:${s}_${suffix}`;
}

export interface OpenGeoWmsOpts {
  layer: string;
  bbox3857: string;
  width: number | string;
  height: number | string;
  /** ISO8601; OpenGeo snaps with nearestValue=1 */
  time?: string | null;
}

/** Build a GetMap URL that cannot omit transparency / PNG. */
export function buildOpenGeoWmsUrl(opts: OpenGeoWmsOpts): string {
  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers: opts.layer,
    crs: 'EPSG:3857',
    bbox: opts.bbox3857,
    width: String(opts.width),
    height: String(opts.height),
    // Mandatory — see reference/README.md "two settings that black out a map"
    format: 'image/png',
    transparent: 'true',
  });
  if (opts.time) params.set('time', opts.time);
  return `https://opengeo.ncep.noaa.gov/geoserver/wms?${params}`;
}
