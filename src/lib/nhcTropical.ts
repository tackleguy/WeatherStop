// NHC tropical products catalog — MapServer layer IDs, colors, normalize.

export type TropicalBasin = 'atl' | 'epac' | 'cpac' | 'all';

export type TropicalProduct =
  | 'cone'
  | 'track'
  | 'points'
  | 'watches'
  | 'gtwo7'
  | 'prob34'
  | 'prob50'
  | 'prob64'
  | 'wind_radii';

export interface TropicalProductDef {
  id: TropicalProduct;
  label: string;
  short: string;
  layerId: number;
  geometry: 'polygon' | 'line' | 'point';
}

export const TROPICAL_PRODUCTS: TropicalProductDef[] = [
  { id: 'cone', label: 'Forecast Cone', short: 'Cone', layerId: 7, geometry: 'polygon' },
  { id: 'track', label: 'Forecast Track', short: 'Track', layerId: 6, geometry: 'line' },
  { id: 'points', label: 'Forecast Points', short: 'Points', layerId: 5, geometry: 'point' },
  { id: 'watches', label: 'Watch / Warning', short: 'WW', layerId: 8, geometry: 'line' },
  { id: 'gtwo7', label: '7-Day Outlook', short: 'GTWO', layerId: 3, geometry: 'polygon' },
  { id: 'prob34', label: 'Prob 34 kt', short: '34kt', layerId: 30, geometry: 'polygon' },
  { id: 'prob50', label: 'Prob 50 kt', short: '50kt', layerId: 31, geometry: 'polygon' },
  { id: 'prob64', label: 'Prob 64 kt', short: '64kt', layerId: 32, geometry: 'polygon' },
  { id: 'wind_radii', label: 'Wind Radii', short: 'Radii', layerId: 15, geometry: 'polygon' },
];

export const BASIN_LABELS: Record<TropicalBasin, string> = {
  all: 'All basins',
  atl: 'Atlantic',
  epac: 'East Pacific',
  cpac: 'Central Pacific',
};

export const BASIN_CENTERS: Record<
  Exclude<TropicalBasin, 'all'>,
  { lon: number; lat: number; zoom: number }
> = {
  atl: { lon: -55, lat: 25, zoom: 3.6 },
  epac: { lon: -120, lat: 15, zoom: 3.8 },
  cpac: { lon: -160, lat: 20, zoom: 3.8 },
};

const MAPSERVER_BASE =
  'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather_summary/MapServer';

export function nhcLayerQueryUrl(layerId: number): string {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    f: 'geojson',
  });
  return `${MAPSERVER_BASE}/${layerId}/query?${params}`;
}

export function getTropicalProduct(id: TropicalProduct): TropicalProductDef {
  return TROPICAL_PRODUCTS.find((p) => p.id === id) ?? TROPICAL_PRODUCTS[0];
}

function basinFromProps(props: Record<string, unknown>): TropicalBasin | null {
  const raw = String(
    props.basin ?? props.BASIN ?? props.Basin ?? props.idp_source ?? '',
  ).toUpperCase();
  if (!raw) return null;
  if (raw.includes('AL') || raw.includes('AT') || raw.startsWith('L')) return 'atl';
  if (raw.includes('EP') || raw.includes('E.')) return 'epac';
  if (raw.includes('CP') || raw.includes('C.')) return 'cpac';
  // Wallet leading chars in idp_source (e.g. al092026)
  if (/^AL/i.test(raw)) return 'atl';
  if (/^EP/i.test(raw)) return 'epac';
  if (/^CP/i.test(raw)) return 'cpac';
  return null;
}

function colorForProduct(
  product: TropicalProduct,
  props: Record<string, unknown>,
): { fill: string; stroke: string } {
  if (product === 'watches') {
    const t = String(props.TCWW ?? props.tcww ?? props.STATUS ?? '').toUpperCase();
    if (t.includes('WARNING') || t.includes('HUR'))
      return { fill: '#ff3b30', stroke: '#ff3b30' };
    if (t.includes('WATCH')) return { fill: '#ff9500', stroke: '#ff9500' };
    return { fill: '#ffcc00', stroke: '#ffcc00' };
  }
  if (product === 'gtwo7') {
    const risk = String(props.RISK2DAY ?? props.risk ?? props.PROB ?? '').toLowerCase();
    if (risk.includes('high') || Number(props.PROB) >= 60)
      return { fill: '#ff3b30', stroke: '#ff6b5a' };
    if (risk.includes('med') || Number(props.PROB) >= 40)
      return { fill: '#ff9500', stroke: '#ffb340' };
    return { fill: '#ffcc00', stroke: '#ffe066' };
  }
  if (product === 'prob34') return { fill: '#3b9eff', stroke: '#7cbcff' };
  if (product === 'prob50') return { fill: '#34c759', stroke: '#7ddf96' };
  if (product === 'prob64') return { fill: '#af52de', stroke: '#c98aeb' };
  if (product === 'cone') return { fill: '#3b9eff', stroke: '#7cbcff' };
  if (product === 'wind_radii') return { fill: '#64d2ff', stroke: '#30b0c7' };
  return { fill: '#ffffff', stroke: '#ffffff' };
}

export interface TropicalFeatureProps {
  fill: string;
  stroke: string;
  label: string;
  basin?: string;
  [key: string]: unknown;
}

export function normalizeTropicalGeoJSON(
  raw: GeoJSON.FeatureCollection | undefined,
  product: TropicalProduct,
  basin: TropicalBasin,
): GeoJSON.FeatureCollection {
  const empty: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [],
  };
  if (!raw?.features) return empty;

  const def = getTropicalProduct(product);
  const features: GeoJSON.Feature[] = [];

  for (const f of raw.features) {
    if (!f.geometry) continue;
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const fb = basinFromProps(props);
    if (basin !== 'all' && fb && fb !== basin) continue;

    const { fill, stroke } = colorForProduct(product, props);
    const label = String(
      props.STORMNAME ??
        props.stormname ??
        props.NAME ??
        props.name ??
        props.WALLET ??
        props.idp_source ??
        def.label,
    );

    features.push({
      ...f,
      properties: {
        ...props,
        fill,
        stroke,
        label,
        basin: fb ?? basin,
        geometryKind: def.geometry,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}
