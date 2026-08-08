// Shared NEXRAD site coords for serverless radar APIs.
// Kept under api/ (not src/) so Vercel bundles it with Node functions.
// ICAO id → [lat, lon]

export const SITE_LATLON: Record<string, [number, number]> = {
  KABR: [45.456, -98.413],
  KABX: [35.15, -106.824],
  KAKQ: [36.984, -77.008],
  KAMA: [35.234, -101.709],
  KAMX: [25.611, -80.413],
  KAPX: [44.907, -84.72],
  KARX: [43.823, -91.191],
  KATX: [48.195, -122.495],
  KBBX: [39.496, -121.632],
  KBGM: [42.2, -75.985],
  KBHX: [40.499, -124.292],
  KBIS: [46.771, -100.76],
  KBLX: [45.854, -108.607],
  KBMX: [33.172, -86.77],
  KBOX: [41.956, -71.137],
  KBRO: [25.916, -97.419],
  KBUF: [42.949, -78.737],
  KBYX: [24.598, -81.703],
  KCAE: [33.949, -81.118],
  KCBW: [46.039, -67.806],
  KCBX: [43.491, -116.236],
  KCCX: [40.923, -78.004],
  KCLE: [41.413, -81.86],
  KCLX: [32.655, -81.042],
  KCRP: [27.784, -97.511],
  KCXX: [44.511, -73.166],
  KCYS: [41.152, -104.806],
  KDAX: [38.501, -121.678],
  KDDC: [37.761, -99.969],
  KDFX: [29.273, -100.28],
  KDGX: [32.28, -89.984],
  KDIX: [39.947, -74.411],
  KDLH: [46.837, -92.21],
  KDMX: [41.731, -93.723],
  KDOX: [38.826, -75.44],
  KDTX: [42.7, -83.472],
  KDVN: [41.612, -90.581],
  KDYX: [32.538, -99.254],
  KEAX: [38.81, -94.264],
  KEMX: [31.894, -110.63],
  KENX: [42.586, -74.064],
  KEOX: [31.46, -85.459],
  KEPZ: [31.873, -106.698],
  KESX: [35.701, -114.892],
  KEVX: [30.565, -85.922],
  KEWX: [29.704, -98.029],
  KEYX: [35.098, -117.561],
  KFCX: [37.024, -80.274],
  KFDR: [34.362, -98.976],
  KFDX: [34.634, -103.619],
  KFFC: [33.363, -84.566],
  KFSD: [43.588, -96.729],
  KFSX: [34.574, -111.198],
  KFTG: [39.786, -104.546],
  KFWS: [32.573, -97.303],
  KGGW: [48.206, -106.625],
  KGJX: [39.062, -108.214],
  KGLD: [39.367, -101.7],
  KGRB: [44.498, -88.111],
  KGRK: [30.722, -97.383],
  KGRR: [42.894, -85.545],
  KGSP: [34.883, -82.11],
  KGWX: [33.897, -88.329],
  KGYX: [43.891, -70.256],
  KHDX: [33.077, -106.12],
  KHGX: [29.472, -95.079],
  KHNX: [36.314, -119.632],
  KHPX: [36.737, -87.285],
  KHTX: [34.931, -86.08],
  KICT: [37.654, -97.443],
  KICX: [37.591, -112.862],
  KILN: [39.42, -83.822],
  KILX: [40.15, -89.337],
  KIND: [39.708, -86.28],
  KINX: [36.175, -95.564],
  KIWA: [33.289, -111.67],
  KIWX: [41.359, -85.7],
  KJAX: [30.485, -81.704],
  KJGX: [32.675, -83.351],
  KJKL: [37.591, -83.313],
  KLBB: [33.654, -101.814],
  KLCH: [30.125, -93.216],
  KLGX: [47.117, -124.107],
  KLIX: [30.337, -89.825],
  KLNX: [41.958, -100.576],
  KLOT: [41.604, -88.085],
  KLRX: [40.74, -116.803],
  KLSX: [41.478, -97.221],
  KLTX: [33.989, -78.429],
  KLVX: [37.975, -85.944],
  KLWX: [38.975, -77.478],
  KLZK: [34.836, -92.262],
  KMAF: [31.943, -102.189],
  KMAX: [42.081, -122.717],
  KMBX: [48.393, -100.864],
  KMHX: [34.776, -76.876],
  KMKX: [42.968, -88.551],
  KMLB: [28.113, -80.654],
  KMOB: [30.679, -88.24],
  KMPX: [44.849, -93.565],
  KMQT: [46.531, -87.548],
  KMRX: [36.168, -83.402],
  KMSX: [47.041, -113.986],
  KMTX: [41.263, -112.448],
  KMUX: [37.155, -121.898],
  KMVX: [47.528, -97.325],
  KMXX: [32.537, -85.79],
  KNKX: [32.919, -117.042],
  KNQA: [35.345, -89.873],
  KOAX: [41.32, -96.366],
  KOHX: [36.247, -86.563],
  KOKX: [40.866, -72.864],
  KOTX: [47.68, -117.627],
  KPAH: [37.068, -88.772],
  KPBZ: [40.532, -80.218],
  KPDT: [45.691, -118.853],
  KPOE: [31.156, -92.976],
  KPUX: [38.46, -104.181],
  KRAX: [35.665, -78.49],
  KRGX: [39.754, -119.462],
  KRIW: [43.066, -108.477],
  KRLX: [38.311, -81.723],
  KRTX: [45.715, -122.965],
  KSFX: [43.106, -112.686],
  KSGF: [37.235, -93.4],
  KSHV: [32.451, -93.841],
  KSJT: [31.371, -100.493],
  KSOX: [33.818, -117.636],
  KSRX: [35.29, -94.362],
  KTBW: [27.706, -82.402],
  KTFX: [47.46, -111.386],
  KTLH: [30.398, -84.329],
  KTLX: [35.333, -97.278],
  KTWX: [38.997, -96.233],
  KTYX: [43.756, -75.68],
  KUDX: [44.125, -102.83],
  KUEX: [40.321, -98.442],
  KVAX: [30.89, -83.002],
  KVBX: [34.838, -120.398],
  KVNX: [36.741, -98.128],
  KVTX: [34.412, -119.179],
  KVWX: [38.26, -87.725],
  KYUX: [32.495, -114.657],
};

/** Bbox for a ~230 km radius around a NEXRAD site. */
export function bboxForSite(siteId: string): [number, number, number, number] {
  const coords = SITE_LATLON[siteId.toUpperCase()];
  if (!coords) throw new Error(`unknown site ${siteId}`);
  const [lat, lon] = coords;
  const dLat = 230 / 111;
  const dLon = 230 / (111 * Math.cos((lat * Math.PI) / 180));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const A =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(A));
}

/**
 * NEXRAD sites whose ~230 km coverage intersects a lon/lat viewport,
 * nearest-to-center first, capped at `limit`.
 */
export function sitesCoveringBbox(
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 16,
): string[] {
  const pad = 2.2; // ~230 km
  const cx = (west + east) / 2;
  const cy = (south + north) / 2;
  const ranked: Array<{ id: string; d: number }> = [];
  for (const [id, [lat, lon]] of Object.entries(SITE_LATLON)) {
    if (
      lon < west - pad ||
      lon > east + pad ||
      lat < south - pad ||
      lat > north + pad
    ) {
      continue;
    }
    ranked.push({ id, d: haversineKm(cy, cx, lat, lon) });
  }
  ranked.sort((a, b) => a.d - b.d);
  return ranked.slice(0, limit).map((r) => r.id);
}
