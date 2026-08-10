#!/usr/bin/env node
/**
 * End-to-end check that every product in the rail actually paints pixels.
 *
 * Status checks on /api are not enough: the endpoints were all returning
 * healthy PNGs while every image-source overlay (velocity, echo tops,
 * precip type, rotation, correlation) rendered blank in the browser. This
 * drives real Chrome, selects each product, and proves the overlay is
 * visible by screenshotting with the layer on and off and diffing.
 *
 * Usage:
 *   DEV_API_PROXY=https://weather-stop.vercel.app npm run dev
 *   node scripts/verify-layers.mjs
 */

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173/radar';
/** Substring filter, e.g. ONLY="Echo Tops" to check a single product. */
const ONLY = process.env.ONLY;
/** Directory to write the on/off screenshot pair for each product. */
const DUMP_DIR = process.env.DUMP_DIR;
const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Random high port so a leaked instance from an earlier run can never be
// mistaken for ours.
const PORT = 9300 + Math.floor(Math.random() * 600);

/** Every overlay layer useRadarLayers can mount. */
const OVERLAY_LAYERS = [
  'rainviewer-radar-layer',
  'rainviewer-satellite-layer',
  'iowa-layer',
  'level2-layer',
  'level3-layer',
  'radar-mosaic-layer',
  'dwd-overlay-layer',
  'gibs-layer',
  'iowa-goes-layer',
  'open-meteo-grid-layer',
  'wms-site-layer',
];

/** aria-label of each rail button, in rail order. */
const PRODUCTS = [
  'Reflectivity',
  'Composite',
  'Echo Tops',
  'Precip Type',
  'Base Velocity',
  'Storm-Rel Velocity',
  'Rotation',
  'Correlation Coefficient',
  'Hydrometeor Class',
  '1-Hour Rainfall',
  'Storm Total',
  'Satellite (IR)',
  'Satellite (Visible)',
  'Wind',
  'Temperature',
];

/** Products that need a closer view than the default CONUS framing. */
const ZOOMED = new Set([
  'Hydrometeor Class',
  '1-Hour Rainfall',
  'Storm Total',
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find(
        (t) => t.type === 'page' && !t.url.startsWith('devtools://'),
      );
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome not up yet.
    }
    await sleep(250);
  }
  throw new Error('Chrome debugger never became available');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.ws.addEventListener('message', (ev) => {
      if (process.env.CDP_DEBUG) console.error('<<', ev.data.slice(0, 400));
      const msg = JSON.parse(ev.data);
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        entry.reject(new Error(`${entry.method}: ${msg.error.message}`));
      } else {
        entry.resolve(msg.result);
      }
    });
  }

  send(method, params = {}, timeoutMs = 90_000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
        method,
      });
      const payload = JSON.stringify({ id, method, params });
      if (process.env.CDP_DEBUG) console.error('>>', payload.slice(0, 300));
      this.ws.send(payload);
    });
  }

  /**
   * Evaluate an async expression in the page and return its value.
   *
   * The result is wrapped page-side so only plain data crosses the
   * protocol. A MapLibre error object holds a reference back to the map,
   * and asking Chrome to serialise that by value fails the whole call with
   * "Object reference chain is too long" rather than reporting the error.
   */
  async eval(expression) {
    const wrapped = `(async () => {
      try {
        return { ok: true, value: await (${expression}) };
      } catch (err) {
        return { ok: false, error: String((err && err.message) || err) };
      }
    })()`;
    const res = await this.send('Runtime.evaluate', {
      expression: wrapped,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text ?? 'page evaluation failed');
    }
    const payload = res.result.value;
    if (!payload?.ok) throw new Error(payload?.error ?? 'page threw');
    return payload.value;
  }

  async screenshot() {
    const { data } = await this.send('Page.captureScreenshot', {
      format: 'png',
    });
    return Buffer.from(data, 'base64');
  }
}

// Basemap labels fade in over a few hundred ms and a translucent overlay
// shifts the whole map by a few levels, so only count changes big enough
// to be actual data being drawn.
const DELTA_THRESHOLD = 40;
/** A layer this sparse is indistinguishable from not rendering at all. */
const MIN_CHANGED = 0.0005;
/** Colour the layer has to add over the basemap to count as rendering data. */
const MIN_CHROMA_GAIN = 0.0002;

/** Saturated enough to be radar colour rather than basemap grey. */
const CHROMA_THRESHOLD = 40;
const BRIGHTNESS_FLOOR = 60;

/** Share of saturated pixels, and mean brightness, for one frame. */
function frameStats(data, w, h) {
  let colourful = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const mx = Math.max(data[i], data[i + 1], data[i + 2]);
    const mn = Math.min(data[i], data[i + 1], data[i + 2]);
    if (mx >= BRIGHTNESS_FLOOR && mx - mn >= CHROMA_THRESHOLD) colourful++;
    sum += mx;
  }
  return { chroma: colourful / (w * h), brightness: sum / (w * h) };
}

/**
 * Pixel change, colour gain and brightness gain between the two frames.
 *
 * "Did anything change" on its own is not a pass: a broken image source
 * paints an opaque black quad over the whole map, which changes plenty of
 * pixels while showing no data. Such a quad both removes colour and darkens
 * the frame, so requiring one or the other to increase separates it from a
 * product that is legitimately drab — one-hour accumulation renders most of
 * the umbrella in the NWS trace-grey, which adds brightness but no colour.
 */
async function compareFrames(a, b) {
  const [ia, ib] = await Promise.all([loadImage(a), loadImage(b)]);
  const w = Math.min(ia.width, ib.width);
  const h = Math.min(ia.height, ib.height);
  const read = (img) => {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, w, h).data;
  };
  const da = read(ia);
  const db = read(ib);
  let changed = 0;
  for (let i = 0; i < da.length; i += 4) {
    const delta = Math.max(
      Math.abs(da[i] - db[i]),
      Math.abs(da[i + 1] - db[i + 1]),
      Math.abs(da[i + 2] - db[i + 2]),
    );
    if (delta >= DELTA_THRESHOLD) changed++;
  }
  const on = frameStats(da, w, h);
  const off = frameStats(db, w, h);
  return {
    changed: changed / (w * h),
    chromaGain: on.chroma - off.chroma,
    brightnessGain: on.brightness - off.brightness,
  };
}

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'ws-verify-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--window-size=1400,900',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let failures = 0;
  try {
    const wsUrl = await cdpTarget();
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    const cdp = new Cdp(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    await cdp.send('Page.navigate', { url: APP_URL });
    console.log(`verify-layers  ${APP_URL}\n`);

    const ready = await cdp.eval(`(async () => {
      for (let i = 0; i < 200; i++) {
        if (window.__wsMap && window.__wsMap.isStyleLoaded()) return 'ready';
        await new Promise((r) => setTimeout(r, 250));
      }
      return 'timeout';
    })()`);
    if (ready !== 'ready') {
      throw new Error(
        `map never loaded (${ready}) — is the dev server running at ${APP_URL}?`,
      );
    }

    if (DUMP_DIR) mkdirSync(DUMP_DIR, { recursive: true });

    for (const product of PRODUCTS) {
      if (ONLY && !product.includes(ONLY)) continue;
      const zoom = ZOOMED.has(product) ? 9 : 4.2;
      const activated = await cdp.eval(`(async () => {
        const map = window.__wsMap;
        map.jumpTo({ center: [-88.5, 41.5], zoom: ${zoom} });
        const sel = '[aria-label=${JSON.stringify(product).replaceAll("'", "\\'")}]';
        // The rail disables products below their minimum zoom from React
        // state, so wait for the jumpTo to propagate before clicking.
        let btn = null;
        for (let i = 0; i < 40; i++) {
          btn = [...document.querySelectorAll(sel)].find((b) => b.tagName === 'BUTTON');
          if (btn && !btn.disabled) break;
          await new Promise((r) => setTimeout(r, 100));
        }
        if (!btn) return { error: 'no rail button' };
        if (btn.disabled) return { error: 'button still disabled at z${zoom}' };
        btn.click();
        const ids = ${JSON.stringify(OVERLAY_LAYERS)};
        for (let i = 0; i < 120; i++) {
          await new Promise((r) => setTimeout(r, 250));
          for (const id of ids) {
            if (!map.getLayer(id)) continue;
            const op = map.getPaintProperty(id, 'raster-opacity');
            if (typeof op === 'number' && op > 0.01) {
              return { layer: id, opacity: op };
            }
          }
        }
        const plan = document.querySelector('[role="status"]')?.textContent ?? '';
        return { error: 'no overlay layer became visible', plan };
      })()`);

      if (activated.error) {
        console.log(`FAIL  ${product.padEnd(22)} ${activated.error}`);
        failures++;
        continue;
      }

      // Let tiles / the image settle, then prove it paints by toggling it off.
      await cdp.eval(`(async () => {
        const map = window.__wsMap;
        for (let i = 0; i < 60; i++) {
          if (map.loaded()) break;
          await new Promise((r) => setTimeout(r, 250));
        }
        await new Promise((r) => setTimeout(r, 1200));
      })()`);

      const withLayer = await cdp.screenshot();
      await cdp.eval(`(async () => {
        const map = window.__wsMap;
        map.setPaintProperty(${JSON.stringify(activated.layer)}, 'raster-opacity', 0);
        map.triggerRepaint();
        await new Promise((r) => setTimeout(r, 600));
      })()`);
      const withoutLayer = await cdp.screenshot();
      // Braces matter: setPaintProperty returns the map for chaining, and
      // returning that by value overflows the protocol serialiser.
      await cdp.eval(
        `(() => { window.__wsMap.setPaintProperty(${JSON.stringify(activated.layer)}, 'raster-opacity', ${activated.opacity}); })()`,
      );

      if (DUMP_DIR) {
        const slug = product.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        writeFileSync(join(DUMP_DIR, `${slug}-on.png`), withLayer);
        writeFileSync(join(DUMP_DIR, `${slug}-off.png`), withoutLayer);
      }

      const { changed, chromaGain, brightnessGain } = await compareFrames(
        withLayer,
        withoutLayer,
      );
      const detail =
        `${activated.layer.padEnd(26)} opacity=${activated.opacity.toFixed(2)}` +
        ` painted=${(changed * 100).toFixed(2)}%` +
        ` colour=${(chromaGain * 100).toFixed(2)}%` +
        ` light=${brightnessGain >= 0 ? '+' : ''}${brightnessGain.toFixed(1)}`;
      if (changed < MIN_CHANGED) {
        console.log(`FAIL  ${product.padEnd(22)} ${detail} (nothing visible)`);
        failures++;
      } else if (chromaGain < MIN_CHROMA_GAIN && brightnessGain <= 0) {
        console.log(
          `FAIL  ${product.padEnd(22)} ${detail} (darkens without drawing)`,
        );
        failures++;
      } else {
        console.log(`OK    ${product.padEnd(22)} ${detail}`);
      }
    }

    ws.close();
  } finally {
    chrome.kill('SIGKILL');
    rmSync(profile, { recursive: true, force: true });
  }

  console.log(
    `\n${failures === 0 ? 'ALL PRODUCTS PAINT' : `${failures} PRODUCT(S) BLANK`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

await main();
