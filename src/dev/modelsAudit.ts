// Live audit of every Open-Meteo model in the catalog.
// Run: npx tsx src/dev/modelsAudit.ts

import {
  MODEL_VARIABLES,
  WEATHER_MODELS,
  modelCoversLocation,
} from '../constants/models';
import { fetchModelForecast } from '../lib/openMeteoModels';

const PLACES: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'Oklahoma City', lat: 35.47, lon: -97.52 },
  { name: 'Ottawa', lat: 45.42, lon: -75.7 },
  { name: 'Frankfurt', lat: 50.11, lon: 8.68 },
  { name: 'Paris', lat: 48.85, lon: 2.35 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Amsterdam', lat: 52.37, lon: 4.9 },
  { name: 'Copenhagen', lat: 55.68, lon: 12.57 },
  { name: 'Oslo', lat: 59.91, lon: 10.75 },
  { name: 'Zurich', lat: 47.38, lon: 8.54 },
  { name: 'Rome', lat: 41.9, lon: 12.5 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'Seoul', lat: 37.57, lon: 126.98 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
];

async function main() {
  const neverOk: string[] = [];

  for (const m of WEATHER_MODELS) {
    const candidates = PLACES.filter((p) => modelCoversLocation(m, p.lat, p.lon));
    const tried = candidates.length ? candidates : PLACES;
    let best: { place: string; days: number; vars: number; miss: string } | null =
      null;
    let lastLabel = 'no attempt';

    for (const p of tried) {
      const s = await fetchModelForecast(p.lat, p.lon, m.id);
      if (s.status !== 'ok') {
        lastLabel = `${s.status}: ${s.error}`;
        continue;
      }
      const missing = MODEL_VARIABLES.map((v) => v.id).filter(
        (v) => !s.available.includes(v),
      );
      best = {
        place: p.name,
        days: Math.round((s.time.length / 24) * 10) / 10,
        vars: s.available.length,
        miss: missing.join(','),
      };
      break;
    }

    if (best) {
      console.log(
        `OK    ${m.id.padEnd(34)} @${best.place.padEnd(14)} ${String(best.days).padStart(4)}d  vars ${best.vars}/8` +
          (best.miss ? `  (no ${best.miss})` : ''),
      );
    } else {
      neverOk.push(m.id);
      console.log(`FAIL  ${m.id.padEnd(34)} ${lastLabel}`);
    }
  }

  console.log(
    `\n${WEATHER_MODELS.length - neverOk.length}/${WEATHER_MODELS.length} models returned data.`,
  );
  if (neverOk.length) console.log(`No data anywhere: ${neverOk.join(', ')}`);

  // Out-of-domain must be reported as such, never as a hard error.
  console.log('\nOut-of-domain handling (European models @ Oklahoma City):');
  for (const id of [
    'icon_d2',
    'meteofrance_arome_france',
    'knmi_harmonie_arome_netherlands',
    'metno_nordic',
    'ukmo_uk_deterministic_2km',
    'italia_meteo_arpae_icon_2i',
  ]) {
    const s = await fetchModelForecast(35.47, -97.52, id);
    console.log(`  ${id.padEnd(34)} ${s.status.padEnd(16)} ${s.error ?? ''}`);
  }
}

void main();
