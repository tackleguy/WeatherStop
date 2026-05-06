# Reference Notes

The five reference repos we plug into the radar app, written from public
documentation rather than a live clone (sandbox limited git access during
this session — clone them yourself with the commands at the bottom).

## OpenFreeMap (`hyperknot/openfreemap`)

**What it is.** Free, no-key vector tile service for global street maps,
served from `tiles.openfreemap.org`. Hosted styles live at
`https://tiles.openfreemap.org/styles/{positron,bright,liberty,dark}`.

**What we use.** The `dark` style URL as our MapLibre base. It already
includes the glyphs/sprites references, so registering it is one line:

```ts
new maplibregl.Map({
  container,
  style: 'https://tiles.openfreemap.org/styles/dark',
});
```

**License.** Permissive. Tiles are provided under OpenStreetMap's
[ODbL](https://www.openstreetmap.org/copyright); attribution is included
automatically by MapLibre's `attributionControl`.

**Gotchas.** None for us — there's no API key, no rate limit. Tiles are
served via Cloudflare. If `openfreemap.org` ever goes down, swap to
`https://demotiles.maplibre.org/style.json` as a fallback.

## nexrad-level-3-data (`netbymatt/nexrad-level-3-data`)

**What it is.** Pure-JS parser for NEXRAD Level III products
(N0Q/N0B/N0V/STI/etc). Returns a typed structure with radials, range
gates, and product metadata.

**What we'll call.**

```ts
import { parse } from 'nexrad-level-3-data';
const data = parse(buffer); // buffer = Uint8Array of the .l3 file
// data.radial_packets[0].radials[i] = { values, azimuth, ... }
// data.product_description.product_code → tells us N0Q vs N0V vs STI
```

**License.** MIT — fine to depend on directly.

**Gotchas.** CommonJS module; on Vercel Edge functions you need
`runtime: 'nodejs'` (not `edge`) because it uses `Buffer`. Bundling
through Vite-SSR or `esbuild` works fine for the API route.

## nexrad-level-2-plot (`netbymatt/nexrad-level-2-plot`)

**What it is.** Parser + plotter for NEXRAD Level II (`*_V06`) volume
files. Outputs a PNG via node-canvas.

**What we'll call.** From an API route:

```ts
import { plot } from 'nexrad-level-2-plot';
const png = await plot(buffer, { product: 'reflectivity', tilt: 0 });
```

**License.** MIT.

**Gotchas.** L2 files are 6–10 MB and parsing takes 1–3 s. Always cache
the rendered PNG to Vercel Blob or similar. node-canvas requires native
deps; `@napi-rs/canvas` (drop-in replacement) ships prebuilt and works
on Vercel — prefer it.

## Windy API (`windycom/API`)

**What it is.** Commercial radar/satellite/wind tile endpoints.

**Endpoint we use.** Composite radar tiles:

```
https://tiles.windy.com/tiles/v10.0/radar/{ts}/{z}/{x}/{y}.png?key={WINDY_KEY}
```

`ts` is a Unix timestamp (rounded to the nearest 5 min) — Windy renders
historic and forecast frames on demand.

**License.** Commercial. Free tier requires `Radar by Windy.com`
attribution when their layer is active. Add a credit pill in the corner
when `pickRadarSource() === 'WINDY'`.

**Gotchas.** Key must stay server-side. Frontend always hits
`/api/radar/windy?z=...&x=...&y=...&ts=...` and the edge function adds
the key from `process.env.WINDY_KEY`.

## supercell-wx (`dpaulat/supercell-wx`)

**⚠️ Architecture / UX reference only — GPL-3.0.** No code paste,
including no line-by-line TS translation. Numeric color tables are not
copyrightable; UX layout decisions are not copyrightable. Anything we
write must be from scratch.

**What we mimic.**

- **Left product rail.** Vertical icon list of L3/L2 products. Selecting
  one updates the active product and refetches.
- **Bottom time scrubber.** 60-minute timeline, 5-min ticks, drag to
  scrub, play/pause loops.
- **Right alerts inspector.** Collapsible per-alert cards sorted by
  severity; click flies to polygon.
- **Station inventory modal.** Grid of all 158 NEXRAD sites with online/
  offline status pulled from `https://api.weather.gov/radar/stations`.

**What we copy literally:** nothing.

## Reference clone commands

```sh
mkdir -p ref && cd ref
git clone --depth 1 https://github.com/hyperknot/openfreemap
git clone --depth 1 https://github.com/netbymatt/nexrad-level-3-data
git clone --depth 1 https://github.com/netbymatt/nexrad-level-2-plot
git clone --depth 1 https://github.com/windycom/API windy-api
git clone --depth 1 https://github.com/dpaulat/supercell-wx
```

`ref/` is gitignored.
