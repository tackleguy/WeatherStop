#!/usr/bin/env node
/**
 * Live-check every upstream + proxied weather endpoint WeatherStop uses.
 * Run: npm run check-endpoints
 *
 * Prints status | bytes | ms | content-type | name for each probe.
 * Exit code 1 if any required probe fails.
 */

const DAY = new Date().toISOString().slice(0, 10);
const BBOX = '-11000000,3500000,-9000000,5500000';
const PROD = process.env.CHECK_BASE ?? 'https://weather-stop.vercel.app';

async function probe(name, url, { required = true, follow = true } = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      redirect: follow ? 'follow' : 'manual',
      headers: {
        Accept: '*/*',
        'User-Agent': 'weather-stop-check-endpoints/1.0 (contact@example.com)',
      },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') ?? '';
    const ms = Date.now() - t0;
    const ok =
      res.ok &&
      (ct.includes('image/') ||
        ct.includes('json') ||
        ct.includes('xml') ||
        buf.length > 100);
    const line = `${ok ? 'OK ' : 'FAIL'} ${res.status} ${String(buf.length).padStart(7)}b ${String(ms).padStart(5)}ms  ${name}`;
    console.log(line);
    if (!ok && required) return false;
    return true;
  } catch (err) {
    console.log(`FAIL ERR              ${name}  (${err instanceof Error ? err.message : err})`);
    return required ? false : true;
  }
}

async function main() {
  console.log(`check-endpoints  base=${PROD}  day=${DAY}\n`);

  const rv = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
  const rvPath = rv.host + (rv.radar?.past?.at(-1)?.path ?? '');
  const satFrames = rv.satellite?.infrared?.length ?? 0;

  const results = [];

  results.push(await probe('RainViewer catalog', 'https://api.rainviewer.com/public/weather-maps.json'));
  results.push(
    await probe(
      'RainViewer radar tile',
      `${rvPath}/256/5/8/12/4/1_1.png`,
    ),
  );
  console.log(`INFO RainViewer satellite.infrared frames: ${satFrames}`);

  results.push(
    await probe(
      'Iowa N0Q tile',
      'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/5/8/12.png',
    ),
  );
  results.push(
    await probe(
      'Iowa GOES IR',
      'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-east-ir-4km-900913/4/3/5.png',
    ),
  );
  results.push(
    await probe(
      'Iowa GOES VIS',
      'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-east-vis-1km-900913/4/3/5.png',
    ),
  );
  results.push(
    await probe(
      'OpenGeo CONUS bref',
      `https://opengeo.ncep.noaa.gov/geoserver/wms?service=WMS&version=1.3.0&request=GetMap&layers=conus:conus_bref_qcd&crs=EPSG:3857&bbox=${BBOX}&width=256&height=256&format=image/png&transparent=true`,
    ),
  );
  results.push(
    await probe(
      'OpenGeo site bvel',
      `https://opengeo.ncep.noaa.gov/geoserver/wms?service=WMS&version=1.3.0&request=GetMap&layers=ktlx:ktlx_sr_bvel&crs=EPSG:3857&bbox=${BBOX}&width=256&height=256&format=image/png&transparent=true`,
    ),
  );
  results.push(
    await probe(
      'GIBS IR',
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_Band13_Clean_Infrared/default/${DAY}/GoogleMapsCompatible_Level6/3/2/1.png`,
    ),
  );
  results.push(
    await probe(
      'Open-Meteo',
      'https://api.open-meteo.com/v1/forecast?latitude=35.2&longitude=-97.4&current=temperature_2m,wind_speed_10m',
    ),
  );
  results.push(
    await probe(
      'NWS alerts',
      'https://api.weather.gov/alerts/active',
    ),
  );

  console.log('\n--- Production proxies ---');
  for (const [name, path] of [
    ['proxy Iowa N0Q', '/api/radar/iowa-state?z=5&x=8&y=12&product=nexrad-n0q-900913'],
    ['proxy CONUS bref', `/api/radar/wms-site?site=conus&product=bref&bbox=${BBOX}&width=256&height=256`],
    ['proxy CONUS neet', `/api/radar/wms-site?site=conus&product=neet&bbox=${BBOX}&width=256&height=256`],
    ['proxy CONUS pcpn', `/api/radar/wms-site?site=conus&product=pcpn&bbox=${BBOX}&width=256&height=256`],
    ['proxy site bdhc', `/api/radar/wms-site?site=ktlx&product=bdhc&bbox=${BBOX}&width=256&height=256`],
    ['proxy mosaic bvel', `/api/radar/mosaic?product=bvel&bbox=${BBOX}&width=512&height=512`],
    ['proxy mosaic rot', `/api/radar/mosaic?product=rot&bbox=${BBOX}&width=512&height=512`],
    ['proxy mosaic n0c', `/api/radar/mosaic?product=n0c&bbox=${BBOX}&width=512&height=512`],
    ['proxy L3 N0S', '/api/radar/level3?site=KTLX&product=N0S'],
    ['proxy L3 N0C', '/api/radar/level3?site=KTLX&product=N0C'],
    ['proxy L2 CC', '/api/radar/level2?site=KTLX&product=correlation'],
    ['proxy temp grid', '/api/weather/grid?z=5&x=8&y=12&layer=temperature'],
    ['proxy wind grid', '/api/weather/grid?z=5&x=8&y=12&layer=wind'],
    ['proxy Iowa IR', '/api/radar/iowa-state?z=4&x=3&y=5&product=goes-east-ir-4km-900913'],
    ['proxy alerts', '/api/alerts'],
  ]) {
    const url = PROD + path;
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        headers: {
          Accept: '*/*',
          'User-Agent': 'weather-stop-check-endpoints/1.0 (contact@example.com)',
        },
      });
      const buf = Buffer.from(await res.arrayBuffer());
      const ms = Date.now() - t0;
      let ok = res.ok && buf.length > 100;
      // Blank L2 CC historically returned ~1125-byte empty PNGs.
      if (name === 'proxy L2 CC' && buf.length < 5000) {
        ok = false;
        console.log(
          `FAIL ${res.status} ${String(buf.length).padStart(7)}b ${String(ms).padStart(5)}ms  ${name} (likely blank CC PNG)`,
        );
      } else {
        console.log(
          `${ok ? 'OK ' : 'FAIL'} ${res.status} ${String(buf.length).padStart(7)}b ${String(ms).padStart(5)}ms  ${name}`,
        );
      }
      results.push(ok);
    } catch (err) {
      console.log(`FAIL ERR              ${name}  (${err instanceof Error ? err.message : err})`);
      results.push(false);
    }
  }

  const failed = results.filter((r) => !r).length;
  console.log(`\n${failed === 0 ? 'ALL REQUIRED PROBES PASSED' : `${failed} REQUIRED PROBE(S) FAILED`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
