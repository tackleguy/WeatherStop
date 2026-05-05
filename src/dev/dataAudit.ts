// Multi-city audit. Run with `npm run audit`. Walks every default city,
// runs loadWeather() through normalize + validate, and reports failures.
// Exits non-zero on any failure so CI can gate deploys on it.

import { DEFAULT_CITIES } from '../constants/cities';
import { loadWeather } from '../lib/normalize';

interface RowResult {
  city: string;
  ok: boolean;
  error?: string;
  source?: string;
  gaps?: string[];
}

async function audit() {
  const results: RowResult[] = [];

  for (const city of DEFAULT_CITIES) {
    const label = `${city.name}${city.region ? `, ${city.region}` : ''}`;
    process.stdout.write(`  ${label.padEnd(32)} `);
    try {
      const snap = await loadWeather(city);
      const meta = snap.data.sourceMeta;
      const tag = `${meta.forecast}/${meta.observations}`;
      results.push({
        city: label,
        ok: true,
        source: tag,
        gaps: meta.gapsFilled,
      });
      process.stdout.write(`✓  ${tag}\n`);
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      results.push({ city: label, ok: false, error: msg });
      process.stdout.write(`✗  ${msg}\n`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\nAUDIT: ${results.length - failed.length}/${results.length} passed`,
  );

  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  ✗ ${f.city}: ${f.error}`);
    process.exit(1);
  }
  console.log('All cities passed validation. ✓');
}

audit();
