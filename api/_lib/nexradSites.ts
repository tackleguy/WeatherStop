// CONUS NEXRAD WSR-88D site list with a haversine "nearest site" picker.
// Used by the radar source resolver to pick which station's per-site
// WMS layer to render at high zoom and which station's velocity to
// fetch. The list is the most-active subset (~140 sites); add Alaska /
// Hawaii / Guam stations later if/when those views are needed.

export interface NexradSite {
  id: string; // ICAO, e.g. KFWS
  name: string;
  state: string;
  lat: number;
  lon: number;
}

export const NEXRAD_SITES: NexradSite[] = [
  { id: 'KABR', name: 'Aberdeen', state: 'SD', lat: 45.456, lon: -98.413 },
  { id: 'KABX', name: 'Albuquerque', state: 'NM', lat: 35.15, lon: -106.824 },
  { id: 'KAKQ', name: 'Wakefield', state: 'VA', lat: 36.984, lon: -77.008 },
  { id: 'KAMA', name: 'Amarillo', state: 'TX', lat: 35.234, lon: -101.709 },
  { id: 'KAMX', name: 'Miami', state: 'FL', lat: 25.611, lon: -80.413 },
  { id: 'KAPX', name: 'Gaylord', state: 'MI', lat: 44.907, lon: -84.72 },
  { id: 'KARX', name: 'La Crosse', state: 'WI', lat: 43.823, lon: -91.191 },
  { id: 'KATX', name: 'Seattle', state: 'WA', lat: 48.195, lon: -122.495 },
  { id: 'KBBX', name: 'Beale AFB', state: 'CA', lat: 39.496, lon: -121.632 },
  { id: 'KBGM', name: 'Binghamton', state: 'NY', lat: 42.2, lon: -75.985 },
  { id: 'KBHX', name: 'Eureka', state: 'CA', lat: 40.499, lon: -124.292 },
  { id: 'KBIS', name: 'Bismarck', state: 'ND', lat: 46.771, lon: -100.76 },
  { id: 'KBLX', name: 'Billings', state: 'MT', lat: 45.854, lon: -108.607 },
  { id: 'KBMX', name: 'Birmingham', state: 'AL', lat: 33.172, lon: -86.77 },
  { id: 'KBOX', name: 'Boston', state: 'MA', lat: 41.956, lon: -71.137 },
  { id: 'KBRO', name: 'Brownsville', state: 'TX', lat: 25.916, lon: -97.419 },
  { id: 'KBUF', name: 'Buffalo', state: 'NY', lat: 42.949, lon: -78.737 },
  { id: 'KBYX', name: 'Key West', state: 'FL', lat: 24.598, lon: -81.703 },
  { id: 'KCAE', name: 'Columbia', state: 'SC', lat: 33.949, lon: -81.118 },
  { id: 'KCBW', name: 'Caribou', state: 'ME', lat: 46.039, lon: -67.806 },
  { id: 'KCBX', name: 'Boise', state: 'ID', lat: 43.491, lon: -116.236 },
  { id: 'KCCX', name: 'State College', state: 'PA', lat: 40.923, lon: -78.004 },
  { id: 'KCLE', name: 'Cleveland', state: 'OH', lat: 41.413, lon: -81.86 },
  { id: 'KCLX', name: 'Charleston', state: 'SC', lat: 32.655, lon: -81.042 },
  { id: 'KCRP', name: 'Corpus Christi', state: 'TX', lat: 27.784, lon: -97.511 },
  { id: 'KCXX', name: 'Burlington', state: 'VT', lat: 44.511, lon: -73.166 },
  { id: 'KCYS', name: 'Cheyenne', state: 'WY', lat: 41.152, lon: -104.806 },
  { id: 'KDAX', name: 'Sacramento', state: 'CA', lat: 38.501, lon: -121.678 },
  { id: 'KDDC', name: 'Dodge City', state: 'KS', lat: 37.761, lon: -99.969 },
  { id: 'KDFX', name: 'Laughlin AFB', state: 'TX', lat: 29.273, lon: -100.281 },
  { id: 'KDGX', name: 'Jackson', state: 'MS', lat: 32.28, lon: -89.984 },
  { id: 'KDIX', name: 'Philadelphia', state: 'PA', lat: 39.947, lon: -74.411 },
  { id: 'KDLH', name: 'Duluth', state: 'MN', lat: 46.837, lon: -92.21 },
  { id: 'KDMX', name: 'Des Moines', state: 'IA', lat: 41.731, lon: -93.723 },
  { id: 'KDOX', name: 'Dover AFB', state: 'DE', lat: 38.826, lon: -75.44 },
  { id: 'KDTX', name: 'Detroit', state: 'MI', lat: 42.7, lon: -83.472 },
  { id: 'KDVN', name: 'Davenport', state: 'IA', lat: 41.612, lon: -90.581 },
  { id: 'KDYX', name: 'Dyess AFB', state: 'TX', lat: 32.538, lon: -99.254 },
  { id: 'KEAX', name: 'Kansas City', state: 'MO', lat: 38.81, lon: -94.264 },
  { id: 'KEMX', name: 'Tucson', state: 'AZ', lat: 31.894, lon: -110.63 },
  { id: 'KENX', name: 'Albany', state: 'NY', lat: 42.586, lon: -74.064 },
  { id: 'KEPZ', name: 'El Paso', state: 'TX', lat: 31.873, lon: -106.698 },
  { id: 'KESX', name: 'Las Vegas', state: 'NV', lat: 35.701, lon: -114.892 },
  { id: 'KEVX', name: 'Eglin AFB', state: 'FL', lat: 30.564, lon: -85.921 },
  { id: 'KEWX', name: 'Austin/San Antonio', state: 'TX', lat: 29.704, lon: -98.029 },
  { id: 'KEYX', name: 'Edwards AFB', state: 'CA', lat: 35.098, lon: -117.561 },
  { id: 'KFCX', name: 'Roanoke', state: 'VA', lat: 37.024, lon: -80.274 },
  { id: 'KFDR', name: 'Frederick', state: 'OK', lat: 34.362, lon: -98.977 },
  { id: 'KFDX', name: 'Cannon AFB', state: 'NM', lat: 34.635, lon: -103.63 },
  { id: 'KFFC', name: 'Atlanta', state: 'GA', lat: 33.364, lon: -84.566 },
  { id: 'KFSD', name: 'Sioux Falls', state: 'SD', lat: 43.588, lon: -96.729 },
  { id: 'KFSX', name: 'Flagstaff', state: 'AZ', lat: 34.574, lon: -111.198 },
  { id: 'KFTG', name: 'Denver', state: 'CO', lat: 39.787, lon: -104.546 },
  { id: 'KFWS', name: 'Dallas/Ft. Worth', state: 'TX', lat: 32.573, lon: -97.303 },
  { id: 'KGGW', name: 'Glasgow', state: 'MT', lat: 48.206, lon: -106.625 },
  { id: 'KGJX', name: 'Grand Junction', state: 'CO', lat: 39.062, lon: -108.214 },
  { id: 'KGLD', name: 'Goodland', state: 'KS', lat: 39.367, lon: -101.7 },
  { id: 'KGRB', name: 'Green Bay', state: 'WI', lat: 44.498, lon: -88.111 },
  { id: 'KGRK', name: 'Fort Hood', state: 'TX', lat: 30.722, lon: -97.383 },
  { id: 'KGRR', name: 'Grand Rapids', state: 'MI', lat: 42.894, lon: -85.545 },
  { id: 'KGSP', name: 'Greer', state: 'SC', lat: 34.883, lon: -82.22 },
  { id: 'KGWX', name: 'Columbus AFB', state: 'MS', lat: 33.897, lon: -88.329 },
  { id: 'KGYX', name: 'Portland', state: 'ME', lat: 43.891, lon: -70.257 },
  { id: 'KHGX', name: 'Houston', state: 'TX', lat: 29.472, lon: -95.079 },
  { id: 'KHNX', name: 'Hanford', state: 'CA', lat: 36.314, lon: -119.632 },
  { id: 'KHPX', name: 'Fort Campbell', state: 'KY', lat: 36.737, lon: -87.285 },
  { id: 'KHTX', name: 'Huntsville', state: 'AL', lat: 34.931, lon: -86.084 },
  { id: 'KICT', name: 'Wichita', state: 'KS', lat: 37.654, lon: -97.443 },
  { id: 'KICX', name: 'Cedar City', state: 'UT', lat: 37.591, lon: -112.862 },
  { id: 'KILN', name: 'Cincinnati', state: 'OH', lat: 39.42, lon: -83.822 },
  { id: 'KILX', name: 'Lincoln', state: 'IL', lat: 40.151, lon: -89.337 },
  { id: 'KIND', name: 'Indianapolis', state: 'IN', lat: 39.708, lon: -86.28 },
  { id: 'KINX', name: 'Tulsa', state: 'OK', lat: 36.175, lon: -95.564 },
  { id: 'KIWA', name: 'Phoenix', state: 'AZ', lat: 33.289, lon: -111.67 },
  { id: 'KIWX', name: 'Northern Indiana', state: 'IN', lat: 41.359, lon: -85.7 },
  { id: 'KJAX', name: 'Jacksonville', state: 'FL', lat: 30.485, lon: -81.702 },
  { id: 'KJGX', name: 'Robins AFB', state: 'GA', lat: 32.675, lon: -83.351 },
  { id: 'KJKL', name: 'Jackson', state: 'KY', lat: 37.591, lon: -83.313 },
  { id: 'KLBB', name: 'Lubbock', state: 'TX', lat: 33.654, lon: -101.814 },
  { id: 'KLCH', name: 'Lake Charles', state: 'LA', lat: 30.125, lon: -93.216 },
  { id: 'KLIX', name: 'New Orleans', state: 'LA', lat: 30.337, lon: -89.825 },
  { id: 'KLNX', name: 'North Platte', state: 'NE', lat: 41.958, lon: -100.576 },
  { id: 'KLOT', name: 'Chicago', state: 'IL', lat: 41.605, lon: -88.085 },
  { id: 'KLRX', name: 'Elko', state: 'NV', lat: 40.74, lon: -116.803 },
  { id: 'KLSX', name: 'St. Louis', state: 'MO', lat: 38.699, lon: -90.683 },
  { id: 'KLTX', name: 'Wilmington', state: 'NC', lat: 33.989, lon: -78.429 },
  { id: 'KLVX', name: 'Louisville', state: 'KY', lat: 37.975, lon: -85.944 },
  { id: 'KLWX', name: 'Sterling', state: 'VA', lat: 38.976, lon: -77.487 },
  { id: 'KLZK', name: 'Little Rock', state: 'AR', lat: 34.836, lon: -92.262 },
  { id: 'KMAF', name: 'Midland/Odessa', state: 'TX', lat: 31.943, lon: -102.189 },
  { id: 'KMAX', name: 'Medford', state: 'OR', lat: 42.081, lon: -122.717 },
  { id: 'KMBX', name: 'Minot', state: 'ND', lat: 48.393, lon: -100.864 },
  { id: 'KMHX', name: 'Morehead City', state: 'NC', lat: 34.776, lon: -76.876 },
  { id: 'KMKX', name: 'Milwaukee', state: 'WI', lat: 42.968, lon: -88.551 },
  { id: 'KMLB', name: 'Melbourne', state: 'FL', lat: 28.113, lon: -80.654 },
  { id: 'KMOB', name: 'Mobile', state: 'AL', lat: 30.679, lon: -88.24 },
  { id: 'KMPX', name: 'Minneapolis', state: 'MN', lat: 44.849, lon: -93.566 },
  { id: 'KMQT', name: 'Marquette', state: 'MI', lat: 46.531, lon: -87.548 },
  { id: 'KMRX', name: 'Knoxville', state: 'TN', lat: 36.169, lon: -83.402 },
  { id: 'KMSX', name: 'Missoula', state: 'MT', lat: 47.041, lon: -113.986 },
  { id: 'KMTX', name: 'Salt Lake City', state: 'UT', lat: 41.263, lon: -112.448 },
  { id: 'KMUX', name: 'San Francisco', state: 'CA', lat: 37.155, lon: -121.898 },
  { id: 'KMVX', name: 'Grand Forks', state: 'ND', lat: 47.528, lon: -97.325 },
  { id: 'KMXX', name: 'Maxwell AFB', state: 'AL', lat: 32.537, lon: -85.79 },
  { id: 'KNKX', name: 'San Diego', state: 'CA', lat: 32.919, lon: -117.041 },
  { id: 'KNQA', name: 'Memphis', state: 'TN', lat: 35.345, lon: -89.873 },
  { id: 'KOAX', name: 'Omaha', state: 'NE', lat: 41.32, lon: -96.367 },
  { id: 'KOHX', name: 'Nashville', state: 'TN', lat: 36.247, lon: -86.563 },
  { id: 'KOKX', name: 'New York City', state: 'NY', lat: 40.866, lon: -72.864 },
  { id: 'KOTX', name: 'Spokane', state: 'WA', lat: 47.681, lon: -117.627 },
  { id: 'KPAH', name: 'Paducah', state: 'KY', lat: 37.068, lon: -88.772 },
  { id: 'KPBZ', name: 'Pittsburgh', state: 'PA', lat: 40.532, lon: -80.218 },
  { id: 'KPDT', name: 'Pendleton', state: 'OR', lat: 45.691, lon: -118.853 },
  { id: 'KPOE', name: 'Fort Polk', state: 'LA', lat: 31.156, lon: -92.976 },
  { id: 'KPUX', name: 'Pueblo', state: 'CO', lat: 38.46, lon: -104.181 },
  { id: 'KRAX', name: 'Raleigh', state: 'NC', lat: 35.665, lon: -78.49 },
  { id: 'KRGX', name: 'Reno', state: 'NV', lat: 39.754, lon: -119.462 },
  { id: 'KRIW', name: 'Riverton', state: 'WY', lat: 43.066, lon: -108.477 },
  { id: 'KRLX', name: 'Charleston', state: 'WV', lat: 38.311, lon: -81.723 },
  { id: 'KRTX', name: 'Portland', state: 'OR', lat: 45.715, lon: -122.965 },
  { id: 'KSFX', name: 'Pocatello', state: 'ID', lat: 43.106, lon: -112.686 },
  { id: 'KSGF', name: 'Springfield', state: 'MO', lat: 37.235, lon: -93.4 },
  { id: 'KSHV', name: 'Shreveport', state: 'LA', lat: 32.451, lon: -93.841 },
  { id: 'KSJT', name: 'San Angelo', state: 'TX', lat: 31.371, lon: -100.492 },
  { id: 'KSOX', name: 'Santa Ana Mountains', state: 'CA', lat: 33.818, lon: -117.636 },
  { id: 'KSRX', name: 'Western Arkansas', state: 'AR', lat: 35.29, lon: -94.362 },
  { id: 'KTBW', name: 'Tampa', state: 'FL', lat: 27.706, lon: -82.402 },
  { id: 'KTFX', name: 'Great Falls', state: 'MT', lat: 47.46, lon: -111.385 },
  { id: 'KTLH', name: 'Tallahassee', state: 'FL', lat: 30.398, lon: -84.329 },
  { id: 'KTLX', name: 'Oklahoma City', state: 'OK', lat: 35.333, lon: -97.278 },
  { id: 'KTWX', name: 'Topeka', state: 'KS', lat: 38.997, lon: -96.233 },
  { id: 'KTYX', name: 'Fort Drum', state: 'NY', lat: 43.756, lon: -75.68 },
  { id: 'KUDX', name: 'Rapid City', state: 'SD', lat: 44.125, lon: -102.83 },
  { id: 'KUEX', name: 'Hastings', state: 'NE', lat: 40.321, lon: -98.442 },
  { id: 'KVAX', name: 'Moody AFB', state: 'GA', lat: 30.89, lon: -83.002 },
  { id: 'KVBX', name: 'Vandenberg AFB', state: 'CA', lat: 34.838, lon: -120.396 },
  { id: 'KVNX', name: 'Vance AFB', state: 'OK', lat: 36.741, lon: -98.128 },
  { id: 'KVTX', name: 'Los Angeles', state: 'CA', lat: 34.412, lon: -119.179 },
  { id: 'KVWX', name: 'Evansville', state: 'IN', lat: 38.26, lon: -87.725 },
  { id: 'KYUX', name: 'Yuma', state: 'AZ', lat: 32.495, lon: -114.657 },
];

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const A =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(A));
}

export function nearestNexradSite(lon: number, lat: number): NexradSite {
  let best = NEXRAD_SITES[0];
  let bestKm = Infinity;
  for (const s of NEXRAD_SITES) {
    const km = haversineKm(lat, lon, s.lat, s.lon);
    if (km < bestKm) {
      best = s;
      bestKm = km;
    }
  }
  return best;
}

// Returns the N nearest sites to a point, sorted by distance ascending.
// Used by the "switch site" picker so the user can pick a different
// radar when the auto-selected one doesn't have a good view.
export function nearestNexradSites(
  lon: number,
  lat: number,
  count = 5,
): Array<{ site: NexradSite; distanceKm: number }> {
  return NEXRAD_SITES.map((site) => ({
    site,
    distanceKm: haversineKm(lat, lon, site.lat, site.lon),
  }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, count);
}
