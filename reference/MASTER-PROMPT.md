# MASTER PROMPT — rebuild the weather map on a proven foundation

> **Keith, read this box first, then paste everything below the line.**
>
> 1. Put `app.html`, `README.md` and `smoketest.js` into your project folder, in a subfolder called `reference/`. The AI needs to read them.
> 2. In Claude Code type `/model` and choose **Opus**. In Cursor/Windsurf pick Claude Opus and enable max/extended thinking.
> 3. Paste everything below the line.
> 4. The AI will stop and ask you two questions (your domain + contact email, and how the site is hosted). Answer them and it will keep going.

---

# TASK: Rebuild this site's weather map layers using the working reference implementation in `reference/app.html`

## Context you need before you do anything

This site's weather map is broken. Radar, velocity, satellite, temperature, wind and several dual-polarization products either show nothing or black out the entire map. A previous AI-assisted attempt made it worse.

**The cause of most of it is already known.** Two things:

1. Several NOAA services the site was built on were retired (`nowcoast.noaa.gov`, the old `radar.weather.gov/ridge/...` image tree, `idpgis.ncep.noaa.gov`). Any layer pointing at those is dead and must be replaced, not repaired.
2. WMS requests were being made without `TRANSPARENT=TRUE` and `FORMAT=image/png`. A WMS server returns an **opaque black tile** in that case, and those tiles cover the whole map. This is what "the map turns black" means.

**`reference/app.html` is a complete, working, tested implementation** of every layer that can run without a server. It has been verified against the live NOAA endpoints. It is your reference — read it before writing anything, and copy its patterns rather than inventing your own. `reference/README.md` explains the design decisions and the failure modes it defends against.

The owner is not a programmer. Explain everything in plain English. Never leave the site in a broken state between commits.

---

## Rules — these are not negotiable

1. **Read `reference/app.html` and `reference/README.md` in full before your first edit.** Everything you need about endpoints, parameters, layer stacking and failure handling is in there and has been tested.
2. **Every WMS layer must go through a single shared factory function** that hardcodes `transparent: true` and `format: 'image/png'`. No layer may construct its own WMS URL. This makes the black-map bug structurally impossible.
3. **The basemap can never be absent.** Add-before-remove on basemap switches; re-assert the basemap after every layer toggle.
4. **Every layer fails alone.** One dead source must never blank the map, break the JavaScript bundle, or produce an unhandled exception.
5. **No paid or key-required services.** No OpenWeatherMap, Windy, Tomorrow.io, Mapbox-with-a-token, AerisWeather, MapTiler weather. Free government and public sources only.
6. **Verify every endpoint with a live request before wiring it in.** If something 404s, say so and use the documented fallback. Never invent a URL.
7. **One layer per commit**, and the site must work after every commit. Work on a branch.
8. **Ship less rather than ship broken.** If a layer can't be made to work, leave it out and tell the owner why.

---

## Phase 0 — Orient, then ask your two questions

1. Detect the stack: framework, map library, bundler, hosting, and whether any backend or serverless functions already exist.
2. Inventory every existing weather data call. Grep for `nowcoast`, `ridge`, `nexrad`, `radar`, `wms`, `opengeo`, `iastate`, `rainviewer`, `goes`, `mrms`, `weather.gov`, `{z}/{x}/{y}`, `L.tileLayer`, `addSource`.
3. Produce a table: **layer in the UI → URL it currently requests → live HTTP status → verdict (retired / CORS / wrong params / rendering / fine)**.
4. Check `git log` for the last commit where the map worked. Report the hash and date. Do not revert anything without asking.

Then ask the owner:

- **Their domain and a contact email.** NOAA requires a `User-Agent` in the form `(example.com, you@example.com)` on server-side requests and returns 403 without it.
- **How the site is hosted** (Vercel / Netlify / Cloudflare / a Node server / static files somewhere). This determines where the backend goes.

Report the inventory and wait for those answers before editing.

---

## Phase 1 — Port the working frontend

Bring every layer from `reference/app.html` into the real site, adapted to its framework and styling. Do not paste the reference file in wholesale; port it properly into the site's own component structure and design language.

The layers, in the order you should implement and commit them:

| # | Layer | Source | Endpoint |
|---|---|---|---|
| 1 | Base reflectivity | NWS MRMS | `https://opengeo.ncep.noaa.gov/geoserver/conus/ows` · `conus_bref_qcd` |
| 2 | Composite reflectivity | NWS MRMS | same workspace · `conus_cref_qcd` |
| 3 | Echo tops | NWS MRMS | same workspace · `conus_neet_v18` |
| 4 | Precipitation type | NWS MRMS | same workspace · `conus_pcpn_typ` |
| 5 | Animated radar | RainViewer | `https://api.rainviewer.com/public/weather-maps.json` |
| 6 | Site reflectivity | NWS per-site | `https://opengeo.ncep.noaa.gov/geoserver/{icao}/ows` · `{icao}_sr_bref` |
| 7 | **Base velocity** | NWS per-site | same · `{icao}_sr_bvel` |
| 8 | Hydrometeor classification | NWS per-site | same · `{icao}_bdhc` |
| 9 | 1-hour rainfall | NWS per-site | same · `{icao}_boha` |
| 10 | Storm total precipitation | NWS per-site | same · `{icao}_bdsa` |
| 11 | Infrared satellite | GOES via RainViewer | satellite frames from the same JSON |
| 12 | Temperature field | Open-Meteo | `https://api.open-meteo.com/v1/forecast` |
| 13 | Wind barbs | Open-Meteo | same |
| 14 | Watches & warnings | NWS | `https://api.weather.gov/alerts/active` |

`{icao}` is the lowercase four-letter radar station id (`ktlx`, `kfws`, `kokx`). The reference implementation includes the station list and the nearest-station logic — reuse it.

Also port these, they are not optional extras:

- **The shared animation timeline.** NOAA's per-site layers expose an ISO8601 `TIME` dimension with `nearestValue=1`, so a generated 5-minute ladder over the last two hours works without fetching a capabilities document. The reference does this in `buildFrames()`.
- **Dedicated layer panes** at fixed stacking levels: satellite 350, radar 400, surface 450, warnings 500.
- **The diagnostics panel** counting loaded vs failed tiles per layer with the failing URL. Keep it behind a toggle in production, but keep it.
- **The reset button.**
- **Opacity control**, defaulting to about 78% for radar and lower for satellite and surface fields.
- **Legends** with correct scales — dBZ for reflectivity, knots with green-inbound/red-outbound for velocity, °F for temperature. Never a generic rainbow ramp on a meteorological product.
- **Timestamp display** showing the observation time in the user's local timezone and how old it is.
- **`invalidateSize()` / `resize()` on window resize and tab focus.** A zero-height container renders black.

---

## Phase 2 — Build the backend for the dual-pol products

These four layers are greyed out in the reference because a static page cannot produce them. This phase makes them real. Do not start it until Phase 1 is committed and working.

Create a backend appropriate to the hosting the owner named — an API route, a serverless function, or an endpoint on the existing server. It must:

- Set `User-Agent: (their-domain, their-email)` on every NOAA request.
- Allowlist upstream hostnames. Never build an open proxy.
- Cache: radar tiles 60s, decoded Level III 120s, satellite 5min, forecast data 10min. Serve stale on upstream failure rather than erroring.
- Return a structured error the frontend can render as "layer temporarily unavailable".

### 2a. Correlation coefficient, ZDR, KDP, storm-relative velocity, spectrum width

Fetch raw NEXRAD Level III products:

```
https://tgftp.nws.noaa.gov/SL.us008001/DF.of/DC.radar/{DS.product}/SI.{icao}/sn.last
```

`sn.last` is the newest scan; `sn.0000`–`sn.0250` is a rotating archive you can use for animation frames. This host sends no CORS headers, which is why it must go through the backend.

| Directory | Product |
|---|---|
| `DS.p161c0` | **Correlation coefficient** (digital, 0.5°) |
| `DS.p159x0` | **Differential reflectivity / ZDR** (digital, 0.5°) |
| `DS.p163k0` | **Specific differential phase / KDP** (digital, 0.5°) |
| `DS.p165h0` | Hydrometeor classification (digital, 0.5°) |
| `DS.p56rm0` | **Storm-relative mean radial velocity** (0.5°) |
| `DS.p30sw` | Spectrum width (0.5°) |
| `DS.p27v0` | Base radial velocity, 124 nmi (0.5°) |
| `DS.p41et` | Echo tops |
| `DS.p57vil` | Vertically integrated liquid |
| `DS.p61tvs` | **Tornadic vortex signature** (point features) |

Confirm these directory names live against `https://tgftp.nws.noaa.gov/SL.us008001/DF.of/DC.radar/` and the product table at `https://www.weather.gov/tg/radfiles` before hardcoding them.

**Decode with a maintained library — do not write a NEXRAD parser.** In Node, `nexrad-level-3-data` handles these digital products and returns gate values with azimuth and range geometry. Verify it supports each product code above; if one isn't supported, say so plainly rather than shipping a broken layer.

**Render** by converting polar (azimuth, range gate) coordinates to geographic using the station's latitude, longitude, elevation and the 0.5° tilt, then rasterizing server-side into PNG tiles or a single georeferenced overlay. Server-side rasterizing is simpler and is what you should do first.

**Correlation coefficient needs the correct scale**, 0.2 to 1.05, with the 0.3–0.8 band visually emphasized. That band is where lofted tornado debris shows up, which is the entire reason people look at this product. A generic rainbow ramp makes it useless.

**Fallback if Level III decoding proves unworkable:** NEXRAD Level II from the AWS open-data bucket `s3://noaa-nexrad-level2/`, path `{YYYY}/{MM}/{DD}/{SITE}/{SITE}{YYYYMMDD}_{HHMMSS}_V06`, decoded with `nexrad-level-2-data` or Py-ART. Full dual-pol moments at native resolution, much larger files. Tell the owner which route you took and why.

### 2b. Rotation

Do the cheap version first — it is what actually matters to a user and it is a fraction of the work.

**Tier 1: point signatures.** Decode `DS.p61tvs` (tornadic vortex signature) and the mesocyclone detection product from the same Level III feed. These are small lists of points with azimuth, range, shear and depth. Plot them as icons over the radar. Fast, cheap, immediately useful.

**Tier 2: azimuthal shear grids.** MRMS publishes these as gzipped GRIB2:

```
https://mrms.ncep.noaa.gov/2D/MergedAzShear_0-2kmAGL/     ← low-level rotation, show this by default
https://mrms.ncep.noaa.gov/2D/MergedAzShear_3-6kmAGL/
https://mrms.ncep.noaa.gov/2D/RotationTrack30min/         ← also 60, 120, 240, 1440
```

Decode server-side (`wgrib2`, `eccodes`, or a Node GRIB2 library), rasterize to PNG, cache ~2 minutes. While you're in that tree, `MergedReflectivityQCComposite/`, `EchoTop_18/` and `VIL/` are available the same way.

---

## Phase 3 — Verify, and show the evidence

Do not report success until all of this is done and shown:

1. **Run `reference/smoketest.js` against the real site**, adapted as needed. It toggles every layer on and off, cycles basemaps, runs the animation, and fails on any thrown error. Extend it to cover the new backend routes. Show the passing output.
2. **Write an endpoint checker** (`npm run check-endpoints`) that hits every upstream URL and prints status, response time and content type. Commit it so it can be re-run when something breaks in six months. Show the output.
3. **Verify each layer over active weather.** Find a location with something happening via `https://api.weather.gov/alerts/active`. A layer rendered over clear sky is indistinguishable from a broken layer.
4. **Screenshot every layer** individually, and one with several enabled together. Show them.
5. **Turn every layer on at once, then off again.** The map must never go black at any point.
6. **Simulate an upstream outage** by blocking one host. Confirm the UI shows a clean "unavailable" state and everything else keeps working.
7. **Hard-refresh with cache disabled.** Confirm a clean console — no errors, no warnings.
8. **Test on a phone-sized viewport.** Every layer renders, the layer picker is thumb-usable, the timeline works.
9. **Confirm no secrets, keys or the owner's email appear in client-side code.**

---

## Phase 4 — Documentation

Write `WEATHER_DATA.md` covering, per layer: source, exact URL pattern, update frequency, whether it goes through the backend and why, cache TTL, fallback, and attribution.

Write `TROUBLESHOOTING.md` with a "the map is black" section listing the checks in order, in plain English:

1. Is a weather overlay opaque? (missing `TRANSPARENT=TRUE` or a JPEG format)
2. Is the map container zero pixels tall?
3. Did the basemap fail while overlays succeeded?
4. Did a JavaScript error stop initialization? (fix the *first* console error, not the loudest)
5. Is a full-screen element covering the map?
6. Is the map stylesheet loading?

Then explain to the owner, in plain English with no jargon: what was broken, what you replaced it with, what you couldn't fix and why, and what to watch for.

---

## Reference: all endpoints, verified live

```
MRMS national mosaics    https://opengeo.ncep.noaa.gov/geoserver/conus/ows
                         conus_bref_qcd · conus_cref_qcd · conus_neet_v18 · conus_pcpn_typ
                         (alaska / hawaii / guam / carib workspaces follow the same pattern)
Per-radar-site products  https://opengeo.ncep.noaa.gov/geoserver/{icao}/ows
                         {icao}_sr_bref · {icao}_sr_bvel · {icao}_bdhc · {icao}_boha · {icao}_bdsa
                         ISO8601 TIME dimension, ~4h history, nearestValue=1
NWS warnings (WMS/WFS)   https://opengeo.ncep.noaa.gov/geoserver/wwa/ows
NWS Level III raw files  https://tgftp.nws.noaa.gov/SL.us008001/DF.of/DC.radar/{DS.prod}/SI.{icao}/sn.last
MRMS GRIB2 grids         https://mrms.ncep.noaa.gov/2D/
NWS API                  https://api.weather.gov          (User-Agent REQUIRED server-side)
NWS NDFD map services    https://mapservices.weather.noaa.gov/
IEM NEXRAD mosaics       https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0q.cgi
IEM GOES satellite       https://mesonet.agron.iastate.edu/cgi-bin/wms/goes_east.cgi  (and goes_west)
IEM single-site tiles    https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::{SITE}-{PROD}-0/{z}/{x}/{y}.png
                         SITE = 3-letter (TLX) · PROD = N0B N0Q N0U N0S N0Z NET
RainViewer               https://api.rainviewer.com/public/weather-maps.json
Open-Meteo               https://api.open-meteo.com/v1/forecast
NEXRAD Level II (AWS)    s3://noaa-nexrad-level2/
NEXRAD Level III (AWS)   s3://unidata-nexrad-level3/
GOES-19 East (AWS)       s3://noaa-goes19/     ← current GOES-East; noaa-goes16 is stale
GOES-18 West (AWS)       s3://noaa-goes18/
```

**Mandatory WMS parameters. Omitting either of the first two is what turns a map black:**

```
TRANSPARENT=TRUE
FORMAT=image/png
VERSION=1.3.0
CRS=EPSG:3857     (match the map's projection; in 1.3.0 with EPSG:4326 the axis order flips to lat,lon)
```

**Retired — if you find any of these in the code, that is the bug:**

```
nowcoast.noaa.gov/arcgis/rest/...
radar.weather.gov/ridge/RadarImg/...   and  /ridge/Overlays/...
idpgis.ncep.noaa.gov/arcgis/rest/...
NEXRAD-n0r-900913 / nexrad-n0r legacy layer names
```

---

**Start with Phase 0. Read `reference/app.html` and `reference/README.md` first, then give me the inventory and your two questions.**
