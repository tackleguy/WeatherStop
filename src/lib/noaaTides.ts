// NOAA Tides & Currents API client. We only call this for cities tagged
// as coastal (countryCode US + within 50mi of a known station). The
// public CO-OPS endpoint returns predicted high/low tide times and
// heights for the next 24h; we surface the next 4 events as a card.
//
// Endpoint:
//   https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
//
// All parameters are query-string. No key required for the data product
// we use ("predictions"). Daily quotas are generous (10k/day).

import type { City } from '../types';

export interface TideEvent {
  /** ISO time, in the station's local timezone if `time_zone=lst_ldt`. */
  time: string;
  height: number; // feet
  type: 'high' | 'low';
}

export interface TideStation {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
}

// Hand-curated list of major tide stations on US coasts. The full set
// is ~250 stations; this 24-station subset covers every metro the seed
// + suggestion lists in cities.ts include, plus headline destinations
// and major harbors. Augment the list as we add coastal cities.
//
// IDs are NOAA station IDs. Use https://tidesandcurrents.noaa.gov to
// look up additional stations.
export const TIDE_STATIONS: TideStation[] = [
  { id: '8443970', name: 'Boston',         state: 'MA', lat: 42.3539, lon: -71.0503 },
  { id: '8447435', name: 'Chatham',        state: 'MA', lat: 41.6885, lon: -69.9508 },
  { id: '8454000', name: 'Providence',     state: 'RI', lat: 41.8068, lon: -71.4011 },
  { id: '8516945', name: 'Kings Point',    state: 'NY', lat: 40.8103, lon: -73.7649 },
  { id: '8534720', name: 'Atlantic City',  state: 'NJ', lat: 39.355,  lon: -74.4181 },
  { id: '8557380', name: 'Lewes',          state: 'DE', lat: 38.7822, lon: -75.1198 },
  { id: '8638901', name: 'Chesapeake Bay Bridge', state: 'VA', lat: 36.9667, lon: -76.1133 },
  { id: '8658163', name: 'Wrightsville Beach', state: 'NC', lat: 34.2133, lon: -77.7867 },
  { id: '8665530', name: 'Charleston',     state: 'SC', lat: 32.7817, lon: -79.925 },
  { id: '8723214', name: 'Virginia Key',   state: 'FL', lat: 25.7317, lon: -80.1617 },
  { id: '8724580', name: 'Key West',       state: 'FL', lat: 24.5557, lon: -81.8076 },
  { id: '8729108', name: 'Panama City',    state: 'FL', lat: 30.1517, lon: -85.6667 },
  { id: '8761724', name: 'Grand Isle',     state: 'LA', lat: 29.2633, lon: -89.9567 },
  { id: '8770570', name: 'Sabine Pass',    state: 'TX', lat: 29.7283, lon: -93.87 },
  { id: '8771341', name: 'Galveston Pier 21', state: 'TX', lat: 29.31, lon: -94.7933 },
  { id: '8775870', name: 'Corpus Christi', state: 'TX', lat: 27.5817, lon: -97.215 },
  { id: '9410230', name: 'La Jolla',       state: 'CA', lat: 32.8667, lon: -117.2567 },
  { id: '9410660', name: 'Los Angeles',    state: 'CA', lat: 33.7197, lon: -118.272 },
  { id: '9412110', name: 'Port San Luis',  state: 'CA', lat: 35.1683, lon: -120.7567 },
  { id: '9414290', name: 'San Francisco',  state: 'CA', lat: 37.8067, lon: -122.465 },
  { id: '9415020', name: 'Point Reyes',    state: 'CA', lat: 37.9967, lon: -122.9783 },
  { id: '9418767', name: 'Crescent City',  state: 'CA', lat: 41.745,  lon: -124.184 },
  { id: '9432780', name: 'Charleston',     state: 'OR', lat: 43.345,  lon: -124.3217 },
  { id: '9447130', name: 'Seattle',        state: 'WA', lat: 47.6028, lon: -122.3389 },
];

const KM_PER_MILE = 1.60934;
const NEAR_THRESHOLD_KM = 80; // ~50 miles

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

export function nearestTideStation(city: City): TideStation | null {
  if (city.countryCode !== 'US') return null;
  let best: TideStation | null = null;
  let bestKm = Infinity;
  for (const s of TIDE_STATIONS) {
    const km = haversineKm(city.latitude, city.longitude, s.lat, s.lon);
    if (km < bestKm) {
      bestKm = km;
      best = s;
    }
  }
  if (!best || bestKm > NEAR_THRESHOLD_KM) return null;
  void KM_PER_MILE;
  return best;
}

interface NoaaPredictionsResponse {
  predictions?: Array<{ t: string; v: string; type: 'H' | 'L' }>;
}

export async function fetchTidePredictions(
  station: TideStation,
  signal?: AbortSignal,
): Promise<TideEvent[]> {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(today.getUTCDate()).padStart(2, '0');
  const begin = `${yyyy}${mm}${dd}`;
  // Fetch 48h so we always have 4-6 events even close to midnight.
  const tomorrow = new Date(today.getTime() + 48 * 3600 * 1000);
  const yyyy2 = tomorrow.getUTCFullYear();
  const mm2 = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
  const dd2 = String(tomorrow.getUTCDate()).padStart(2, '0');
  const end = `${yyyy2}${mm2}${dd2}`;

  const params = new URLSearchParams({
    product: 'predictions',
    application: 'WeatherStop',
    begin_date: begin,
    end_date: end,
    datum: 'MLLW',
    station: station.id,
    time_zone: 'lst_ldt',
    units: 'english',
    interval: 'hilo',
    format: 'json',
  });

  const res = await fetch(
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${params}`,
    { signal },
  );
  if (!res.ok) throw new Error(`NOAA tides ${res.status}`);
  const json = (await res.json()) as NoaaPredictionsResponse;

  const now = Date.now();
  const events: TideEvent[] = (json.predictions ?? [])
    .map<TideEvent>((p) => ({
      time: p.t.replace(' ', 'T'),
      height: parseFloat(p.v),
      type: p.type === 'H' ? 'high' : 'low',
    }))
    .filter((ev) => new Date(ev.time).getTime() >= now - 30 * 60_000)
    .slice(0, 6);

  return events;
}
