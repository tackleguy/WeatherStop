// SPC convective + fire weather outlooks proxy. Tries NOAA MapServer
// first (convective), then SPC GeoJSON URLs (fire + fallback).

export const config = { runtime: 'edge' };

type OutlookDay = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type OutlookProduct =
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

const MAPSERVER_LAYER: Partial<
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

function spcGeoJsonUrl(
  day: OutlookDay,
  product: OutlookProduct,
): string | null {
  if (product === 'cat' && day <= 3) {
    return `https://www.spc.noaa.gov/products/outlook/day${day}otlk_cat.lyr.geojson`;
  }
  if (day <= 2) {
    const map: Partial<Record<OutlookProduct, string>> = {
      tornado: `https://www.spc.noaa.gov/products/outlook/day${day}otlk_torn.lyr.geojson`,
      hail: `https://www.spc.noaa.gov/products/outlook/day${day}otlk_hail.lyr.geojson`,
      wind: `https://www.spc.noaa.gov/products/outlook/day${day}otlk_wind.lyr.geojson`,
      tornado_cig: `https://www.spc.noaa.gov/products/outlook/day${day}otlk_cigtorn.lyr.geojson`,
      hail_cig: `https://www.spc.noaa.gov/products/outlook/day${day}otlk_cighail.lyr.geojson`,
      wind_cig: `https://www.spc.noaa.gov/products/outlook/day${day}otlk_cigwind.lyr.geojson`,
      fire_dryt: `https://www.spc.noaa.gov/products/fire_wx/day${day}fw_dryt.lyr.geojson`,
      fire_windrh: `https://www.spc.noaa.gov/products/fire_wx/day${day}fw_windrh.lyr.geojson`,
    };
    return map[product] ?? null;
  }
  if (day === 3) {
    if (product === 'prob')
      return 'https://www.spc.noaa.gov/products/outlook/day3otlk_prob.lyr.geojson';
    if (product === 'severe_cig')
      return 'https://www.spc.noaa.gov/products/outlook/day3otlk_cigprob.lyr.geojson';
  }
  if (day >= 4 && product === 'prob') {
    return `https://www.spc.noaa.gov/products/exper/day4-8/day${day}prob.lyr.geojson`;
  }
  if (day >= 3) {
    const base = 'https://www.spc.noaa.gov/products/exper/fire_wx';
    if (product === 'fire_dryt_cat')
      return `${base}/day${day}fw_drytcat.lyr.geojson`;
    if (product === 'fire_dryt_prob')
      return `${base}/day${day}fw_drytprob.lyr.geojson`;
    if (product === 'fire_windrh_cat')
      return `${base}/day${day}fw_windrhcat.lyr.geojson`;
    if (product === 'fire_windrh_prob')
      return `${base}/day${day}fw_windrhprob.lyr.geojson`;
  }
  return null;
}

const MAPSERVER_BASE =
  'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer';

const PRODUCTS: OutlookProduct[] = [
  'cat',
  'tornado',
  'hail',
  'wind',
  'tornado_cig',
  'hail_cig',
  'wind_cig',
  'severe_cig',
  'prob',
  'fire_dryt',
  'fire_windrh',
  'fire_dryt_cat',
  'fire_dryt_prob',
  'fire_windrh_cat',
  'fire_windrh_prob',
];

function parseDay(raw: string | null): OutlookDay {
  const n = Number(raw);
  if (n >= 1 && n <= 8) return n as OutlookDay;
  return 1;
}

function parseProduct(raw: string | null): OutlookProduct {
  if (raw && (PRODUCTS as string[]).includes(raw)) return raw as OutlookProduct;
  return 'cat';
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/geo+json, application/json',
        'User-Agent':
          process.env.NWS_USER_AGENT ??
          'weather-stop/1.0 (contact@example.com)',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function mapServerUrl(layerId: number): string {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    f: 'geojson',
  });
  return `${MAPSERVER_BASE}/${layerId}/query?${params.toString()}`;
}

function isFeatureCollection(data: unknown): boolean {
  return (
    !!data &&
    typeof data === 'object' &&
    'features' in data &&
    Array.isArray((data as { features: unknown[] }).features)
  );
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const day = parseDay(searchParams.get('day'));
  const product = parseProduct(searchParams.get('product'));

  let data: unknown | null = null;
  let source: 'mapserver' | 'spc' = 'mapserver';

  const layerId = MAPSERVER_LAYER[day]?.[product];
  if (layerId !== undefined) {
    data = await fetchJson(mapServerUrl(layerId));
  }

  if (!isFeatureCollection(data)) {
    const fallback = spcGeoJsonUrl(day, product);
    if (fallback) {
      data = await fetchJson(fallback);
      source = 'spc';
    }
  }

  if (!isFeatureCollection(data)) {
    return new Response('SPC outlooks unavailable', { status: 503 });
  }

  const payload = {
    ...(data as object),
    meta: { day, product, source },
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/geo+json',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
