// SPC convective + fire weather outlook catalog, colors, and GeoJSON
// normalization. Client can fetch SPC GeoJSON directly (CORS enabled).

export type OutlookDomain = 'convective' | 'fire';
export type OutlookDay = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type OutlookProduct =
  | 'cat'
  | 'tornado'
  | 'hail'
  | 'wind'
  | 'tornado_cig'
  | 'hail_cig'
  | 'wind_cig'
  | 'severe_cig'
  | 'prob'
  | 'fire_dryt'
  | 'fire_windrh'
  | 'fire_dryt_cat'
  | 'fire_dryt_prob'
  | 'fire_windrh_cat'
  | 'fire_windrh_prob';

export type OutlookLegendKind = 'cat' | 'prob' | 'cig' | 'fire';

export interface OutlookProductDef {
  id: OutlookProduct;
  label: string;
  short: string;
  legend: OutlookLegendKind;
}

/** NOAA MapServer layer IDs (convective only). */
export const MAPSERVER_LAYER: Partial<
  Record<OutlookDay, Partial<Record<OutlookProduct, number>>>
> = {
  1: {
    cat: 1,
    tornado_cig: 2,
    tornado: 3,
    hail_cig: 4,
    hail: 5,
    wind_cig: 6,
    wind: 7,
  },
  2: {
    cat: 9,
    tornado_cig: 10,
    tornado: 11,
    hail_cig: 12,
    hail: 13,
    wind_cig: 14,
    wind: 15,
  },
  3: { cat: 17, severe_cig: 18, prob: 19 },
  4: { prob: 21 },
  5: { prob: 22 },
  6: { prob: 23 },
  7: { prob: 24 },
  8: { prob: 25 },
};

/** Direct SPC GeoJSON URLs (CORS *). */
export function spcGeoJsonUrl(
  day: OutlookDay,
  product: OutlookProduct,
): string | null {
  const d = day;
  if (product === 'cat' && d <= 3) {
    return `https://www.spc.noaa.gov/products/outlook/day${d}otlk_cat.lyr.geojson`;
  }
  if (d <= 2) {
    const map: Partial<Record<OutlookProduct, string>> = {
      tornado: `https://www.spc.noaa.gov/products/outlook/day${d}otlk_torn.lyr.geojson`,
      hail: `https://www.spc.noaa.gov/products/outlook/day${d}otlk_hail.lyr.geojson`,
      wind: `https://www.spc.noaa.gov/products/outlook/day${d}otlk_wind.lyr.geojson`,
      tornado_cig: `https://www.spc.noaa.gov/products/outlook/day${d}otlk_cigtorn.lyr.geojson`,
      hail_cig: `https://www.spc.noaa.gov/products/outlook/day${d}otlk_cighail.lyr.geojson`,
      wind_cig: `https://www.spc.noaa.gov/products/outlook/day${d}otlk_cigwind.lyr.geojson`,
    };
    return map[product] ?? null;
  }
  if (d === 3) {
    if (product === 'prob')
      return 'https://www.spc.noaa.gov/products/outlook/day3otlk_prob.lyr.geojson';
    if (product === 'severe_cig')
      return 'https://www.spc.noaa.gov/products/outlook/day3otlk_cigprob.lyr.geojson';
  }
  if (d >= 4 && product === 'prob') {
    return `https://www.spc.noaa.gov/products/exper/day4-8/day${d}prob.lyr.geojson`;
  }

  // Fire weather
  if (d <= 2) {
    if (product === 'fire_dryt')
      return `https://www.spc.noaa.gov/products/fire_wx/day${d}fw_dryt.lyr.geojson`;
    if (product === 'fire_windrh')
      return `https://www.spc.noaa.gov/products/fire_wx/day${d}fw_windrh.lyr.geojson`;
  }
  if (d >= 3) {
    const base = 'https://www.spc.noaa.gov/products/exper/fire_wx';
    if (product === 'fire_dryt_cat')
      return `${base}/day${d}fw_drytcat.lyr.geojson`;
    if (product === 'fire_dryt_prob')
      return `${base}/day${d}fw_drytprob.lyr.geojson`;
    if (product === 'fire_windrh_cat')
      return `${base}/day${d}fw_windrhcat.lyr.geojson`;
    if (product === 'fire_windrh_prob')
      return `${base}/day${d}fw_windrhprob.lyr.geojson`;
  }
  return null;
}

const CONV_D12: OutlookProductDef[] = [
  { id: 'cat', label: 'Categorical', short: 'Cat', legend: 'cat' },
  { id: 'tornado', label: 'Tornado', short: 'Tor', legend: 'prob' },
  { id: 'hail', label: 'Hail', short: 'Hail', legend: 'prob' },
  { id: 'wind', label: 'Wind', short: 'Wind', legend: 'prob' },
  { id: 'tornado_cig', label: 'Tor CIG', short: 'T·CIG', legend: 'cig' },
  { id: 'hail_cig', label: 'Hail CIG', short: 'H·CIG', legend: 'cig' },
  { id: 'wind_cig', label: 'Wind CIG', short: 'W·CIG', legend: 'cig' },
];

const CONV_D3: OutlookProductDef[] = [
  { id: 'cat', label: 'Categorical', short: 'Cat', legend: 'cat' },
  { id: 'prob', label: 'Severe Prob', short: 'Prob', legend: 'prob' },
  { id: 'severe_cig', label: 'Severe CIG', short: 'CIG', legend: 'cig' },
];

const CONV_D48: OutlookProductDef[] = [
  { id: 'prob', label: 'Severe Prob', short: 'Prob', legend: 'prob' },
];

const FIRE_D12: OutlookProductDef[] = [
  { id: 'fire_dryt', label: 'Dry Thunderstorm', short: 'DryT', legend: 'fire' },
  { id: 'fire_windrh', label: 'Wind / RH', short: 'W/RH', legend: 'fire' },
];

const FIRE_D38: OutlookProductDef[] = [
  {
    id: 'fire_dryt_cat',
    label: 'DryT Cat',
    short: 'DT·C',
    legend: 'fire',
  },
  {
    id: 'fire_dryt_prob',
    label: 'DryT Prob',
    short: 'DT·P',
    legend: 'prob',
  },
  {
    id: 'fire_windrh_cat',
    label: 'Wind/RH Cat',
    short: 'WR·C',
    legend: 'fire',
  },
  {
    id: 'fire_windrh_prob',
    label: 'Wind/RH Prob',
    short: 'WR·P',
    legend: 'prob',
  },
];

export function productsFor(
  domain: OutlookDomain,
  day: OutlookDay,
): OutlookProductDef[] {
  if (domain === 'fire') {
    return day <= 2 ? FIRE_D12 : FIRE_D38;
  }
  if (day <= 2) return CONV_D12;
  if (day === 3) return CONV_D3;
  return CONV_D48;
}

export function defaultProduct(
  domain: OutlookDomain,
  day: OutlookDay,
): OutlookProduct {
  return productsFor(domain, day)[0].id;
}

export function legendKindFor(
  domain: OutlookDomain,
  day: OutlookDay,
  product: OutlookProduct,
): OutlookLegendKind {
  return (
    productsFor(domain, day).find((p) => p.id === product)?.legend ?? 'cat'
  );
}

/** Official-ish SPC categorical palette (TSTM → HIGH). */
export const CAT_COLORS: Record<string, string> = {
  TSTM: '#C1E9C1',
  GENERAL: '#C1E9C1',
  '2': '#C1E9C1',
  MRGL: '#66A366',
  MARGINAL: '#66A366',
  '3': '#66A366',
  SLGT: '#FFE066',
  SLIGHT: '#FFE066',
  '4': '#FFE066',
  ENH: '#FFA366',
  ENHANCED: '#FFA366',
  '5': '#FFA366',
  MDT: '#E06666',
  MODERATE: '#E06666',
  '6': '#E06666',
  HIGH: '#EE99EE',
  '8': '#EE99EE',
};

export const PROB_COLORS: Array<{ max: number; color: string; label: string }> =
  [
    { max: 5, color: '#008B00', label: '5%' },
    { max: 10, color: '#8B4726', label: '10%' },
    { max: 15, color: '#FFC800', label: '15%' },
    { max: 30, color: '#FF0000', label: '30%' },
    { max: 45, color: '#FF00FF', label: '45%' },
    { max: 60, color: '#912CEE', label: '60%' },
  ];

export const CIG_COLORS: Record<string, string> = {
  CIG1: '#4b5563',
  CIG2: '#1f2937',
  CIG3: '#111827',
  SIGNIFICANT: '#7c3aed',
  SIG: '#7c3aed',
};

export const FIRE_COLORS: Record<string, string> = {
  ELEVATED: '#eab308',
  CRITICAL: '#ef4444',
  EXTREME: '#a855f7',
  ISO: '#86efac',
  SCT: '#4ade80',
  NUM: '#f97316',
  '10': '#eab308',
  '40': '#ef4444',
  '70': '#a855f7',
};

export const CAT_LEGEND: Array<{ key: string; label: string; color: string }> =
  [
    { key: 'TSTM', label: 'Thunderstorm', color: CAT_COLORS.TSTM },
    { key: 'MRGL', label: 'Marginal', color: CAT_COLORS.MRGL },
    { key: 'SLGT', label: 'Slight', color: CAT_COLORS.SLGT },
    { key: 'ENH', label: 'Enhanced', color: CAT_COLORS.ENH },
    { key: 'MDT', label: 'Moderate', color: CAT_COLORS.MDT },
    { key: 'HIGH', label: 'High', color: CAT_COLORS.HIGH },
  ];

export const CIG_LEGEND = [
  { key: 'CIG1', label: 'CIG 1', color: CIG_COLORS.CIG1 },
  { key: 'CIG2', label: 'CIG 2', color: CIG_COLORS.CIG2 },
  { key: 'CIG3', label: 'CIG 3', color: CIG_COLORS.CIG3 },
];

export const FIRE_LEGEND = [
  { key: 'ELEVATED', label: 'Elevated', color: FIRE_COLORS.ELEVATED },
  { key: 'CRITICAL', label: 'Critical', color: FIRE_COLORS.CRITICAL },
  { key: 'EXTREME', label: 'Extreme', color: FIRE_COLORS.EXTREME },
];

export interface OutlookFeatureProps {
  label: string;
  label2?: string;
  valid?: string;
  expire?: string;
  issue?: string;
  dn?: number;
  fill: string;
  stroke: string;
}

function normalizeLabel(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase();
}

function colorForCat(label: string, dn?: number): string {
  if (dn !== undefined && CAT_COLORS[String(dn)]) return CAT_COLORS[String(dn)];
  const key = label.replace(/\s+/g, '');
  return CAT_COLORS[key] ?? CAT_COLORS[label] ?? '#94a3b8';
}

function colorForProb(dn: number | undefined, label: string): string {
  if (typeof dn === 'number' && Number.isFinite(dn)) {
    for (const row of PROB_COLORS) {
      if (dn <= row.max) return row.color;
    }
    return PROB_COLORS[PROB_COLORS.length - 1].color;
  }
  const m = label.match(/(\d+)/);
  if (m) {
    const n = Number(m[1]);
    for (const row of PROB_COLORS) {
      if (n <= row.max) return row.color;
    }
  }
  return '#94a3b8';
}

function colorForCig(label: string): string {
  const key = label.replace(/\s+/g, '');
  return CIG_COLORS[key] ?? CIG_COLORS[label] ?? '#374151';
}

function colorForFire(label: string, dn?: number): string {
  if (dn !== undefined && FIRE_COLORS[String(dn)])
    return FIRE_COLORS[String(dn)];
  const key = label.replace(/\s+/g, '');
  return FIRE_COLORS[key] ?? FIRE_COLORS[label] ?? colorForCat(label, dn);
}

export function colorForOutlook(
  product: OutlookProduct,
  props: Record<string, unknown>,
): { fill: string; stroke: string; label: string } {
  const label =
    normalizeLabel(props.label) ||
    normalizeLabel(props.LABEL) ||
    normalizeLabel(props.label2) ||
    '—';
  const dnRaw = props.dn ?? props.DN;
  const dn = typeof dnRaw === 'number' ? dnRaw : Number(dnRaw);
  const dnOk = Number.isFinite(dn) ? dn : undefined;

  const isCig =
    product.includes('cig') ||
    product === 'severe_cig' ||
    label.startsWith('CIG');
  const isFire = product.startsWith('fire_');
  const isProb =
    product === 'tornado' ||
    product === 'hail' ||
    product === 'wind' ||
    product === 'prob' ||
    product.endsWith('_prob');

  if (isCig) {
    const fill = colorForCig(label);
    return { fill, stroke: fill, label };
  }
  if (isFire && !isProb) {
    const fill = colorForFire(label, dnOk);
    return { fill, stroke: fill, label };
  }
  if (product === 'cat' || (isFire && product.endsWith('_cat'))) {
    const fill = isFire ? colorForFire(label, dnOk) : colorForCat(label, dnOk);
    return { fill, stroke: fill, label };
  }
  if (isProb || isFire) {
    const fill = colorForProb(dnOk, label);
    return { fill, stroke: fill, label };
  }
  const fill = colorForCat(label, dnOk);
  return { fill, stroke: fill, label };
}

export function normalizeOutlookGeoJSON(
  data: GeoJSON.FeatureCollection | null | undefined,
  product: OutlookProduct,
): GeoJSON.FeatureCollection {
  if (!data || !Array.isArray(data.features)) {
    return { type: 'FeatureCollection', features: [] };
  }

  const features: GeoJSON.Feature[] = data.features
    .filter((f) => f && f.geometry)
    .map((f, i) => {
      const raw = (f.properties ?? {}) as Record<string, unknown>;
      const colored = colorForOutlook(product, raw);
      const props: OutlookFeatureProps = {
        label: colored.label,
        label2:
          typeof raw.label2 === 'string'
            ? raw.label2
            : typeof raw.LABEL2 === 'string'
              ? raw.LABEL2
              : undefined,
        valid:
          typeof raw.valid === 'string'
            ? raw.valid
            : typeof raw.VALID === 'string'
              ? raw.VALID
              : undefined,
        expire:
          typeof raw.expire === 'string'
            ? raw.expire
            : typeof raw.EXPIRE === 'string'
              ? raw.EXPIRE
              : undefined,
        issue:
          typeof raw.issue === 'string'
            ? raw.issue
            : typeof raw.ISSUE === 'string'
              ? raw.ISSUE
              : undefined,
        dn:
          typeof raw.dn === 'number'
            ? raw.dn
            : typeof raw.DN === 'number'
              ? raw.DN
              : undefined,
        fill: colored.fill,
        stroke: colored.stroke,
      };
      return {
        type: 'Feature' as const,
        id: f.id ?? i,
        geometry: f.geometry,
        properties: props,
      };
    });

  return { type: 'FeatureCollection', features };
}
