#!/usr/bin/env node
/**
 * Live-check every upstream + proxied weather endpoint WeatherStop uses.
 * Run: npm run check-endpoints
 *
 * Prints status | bytes | ms | content-type | name for each probe.
 * Exit code 1 if any required probe fails.
 */

import { createCanvas, loadImage } from '@napi-rs/canvas';

const DAY = new Date().toISOString().slice(0, 10);
const BBOX = '-11000000,3500000,-9000000,5500000';
// Web Mercator metre boxes matching real viewports.
const BBOX_CONUS = '-13914936,2753408,-7347086,6446276';
const BBOX_CHICAGO = '-10130074,4721672,-9462157,5465442';
const PROD = process.env.CHECK_BASE ?? 'https://weather-stop.vercel.app';

/** Radar can legitimately be quiet, so this only catches a frame that is
 *  entirely transparent — not one that is merely sparse. Actual coverage is
 *  printed so a human can spot a suspicious drop. */
const MIN_PAINTED = 0.0005;

function isPng(buf) {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

/** Fraction of pixels with a non-negligible alpha. */
async function paintedFraction(buf) {
  const img = await loadImage(buf);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  let painted = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 8) painted++;
  return {
    painted: painted / (img.width * img.height),
    dims: `${img.width}x${img.height}`,
  };
}

/**
 * Assert an endpoint returns a decodable PNG with something drawn in it.
 * A 200 with a fully transparent body is the failure mode that made every
 * image-source product look broken while every status check passed.
 */
async function probeImage(name, path) {
  const t0 = Date.now();
  try {
    const res = await fetch(PROD + path, {
      headers: {
        Accept: 'image/png',
        'User-Agent': 'weather-stop-check-endpoints/1.0 (contact@example.com)',
      },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const ms = Date.now() - t0;
    const stamp = `${res.status} ${String(buf.length).padStart(7)}b ${String(ms).padStart(5)}ms`;

    if (!res.ok) {
      console.log(`FAIL ${stamp}  ${name}  (HTTP ${res.status})`);
      return false;
    }
    if (!isPng(buf)) {
      console.log(`FAIL ${stamp}  ${name}  (not a PNG)`);
      return false;
    }
    const { painted, dims } = await paintedFraction(buf);
    const pct = `${(painted * 100).toFixed(2)}%`;
    if (painted < MIN_PAINTED) {
      console.log(`FAIL ${stamp}  ${name}  ${dims} painted=${pct} (blank frame)`);
      return false;
    }
    console.log(`OK   ${stamp}  ${name}  ${dims} painted=${pct}`);
    return true;
  } catch (err) {
    console.log(
      `FAIL ERR              ${name}  (${err instanceof Error ? err.message : err})`,
    );
    return false;
  }
}

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

  console.log('\n--- Image content (PNG magic + painted pixels) ---');
  for (const [name, path] of [
    ['mosaic bvel CONUS', `/api/radar/mosaic?product=bvel&bbox=${BBOX_CONUS}&width=1024&height=1024`],
    ['mosaic n0s CONUS', `/api/radar/mosaic?product=n0s&bbox=${BBOX_CONUS}&width=1024&height=1024`],
    ['mosaic rot CONUS', `/api/radar/mosaic?product=rot&bbox=${BBOX_CONUS}&width=1024&height=1024`],
    ['mosaic n0c CONUS', `/api/radar/mosaic?product=n0c&bbox=${BBOX_CONUS}&width=1024&height=1024`],
    ['mosaic bvel regional', `/api/radar/mosaic?product=bvel&bbox=${BBOX_CHICAGO}&width=1024&height=1024`],
    ['wms neet conus', `/api/radar/wms-site?site=conus&product=neet&bbox=${BBOX_CONUS}&width=1024&height=1024`],
    ['wms pcpn conus', `/api/radar/wms-site?site=conus&product=pcpn&bbox=${BBOX_CONUS}&width=1024&height=1024`],
    ['wms bref conus', `/api/radar/wms-site?site=conus&product=bref&bbox=${BBOX_CONUS}&width=1024&height=1024`],
    ['wms bvel site', `/api/radar/wms-site?site=klot&product=bvel&bbox=${BBOX}&width=1024&height=1024`],
    ['L3 N0S KTLX', '/api/radar/level3?site=KTLX&product=N0S'],
    ['L3 ROT KTLX', '/api/radar/level3?site=KTLX&product=ROT'],
    ['L3 N0C KTLX', '/api/radar/level3?site=KTLX&product=N0C'],
  ]) {
    results.push(await probeImage(name, path));
  }

  const failed = results.filter((r) => !r).length;
  console.log(`\n${failed === 0 ? 'ALL REQUIRED PROBES PASSED' : `${failed} REQUIRED PROBE(S) FAILED`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
