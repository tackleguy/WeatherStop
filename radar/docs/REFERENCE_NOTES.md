# Reference Notes

This file is a written-from-public-knowledge brief on each upstream we
read for inspiration or depend on at runtime. The reference repos
themselves are not vendored — clone them yourself into `ref/` (gitignored)
if you want to read them locally:

```sh
mkdir -p ref && cd ref
git clone --depth 1 https://github.com/cwdaniel/RadrView
git clone --depth 1 https://github.com/windycom/API windy-api
git clone --depth 1 https://github.com/hyperknot/openfreemap
cd ..
```

Before reading any of these locally, **open `LICENSE`** and confirm it's
MIT, Apache-2.0, BSD, or ISC. If GPL/AGPL/LGPL, stop — this codebase is
permissive-license-only, no GPL code or line-by-line ports.

## RadrView (`cwdaniel/RadrView`)

**License (per repo):** MIT (verify locally before reading).
**Purpose:** open-source NEXRAD radar viewer.
**What we adopt:** layout idioms — left product picker, bottom time
scrubber, right alerts inspector. These idioms are also the convention
in many GIS tools, video editors, DAWs, and aren't unique to any
specific weather app.
**What we don't adopt:** any UI code, any specific component structure,
any state-management choice.

## Windy API (`windycom/API`)

**License:** typically Apache-2.0 for the example repo; tile usage is
governed by the commercial Windy API Terms (free tier with attribution).
**Purpose:** Windy's tile server documentation.
**What we use:** the tile URL pattern
`https://tiles.windy.com/tiles/v10.0/{product}-{ts}/{z}/{x}/{y}.png?key=…`
proxied through `api/radar/windy.ts` so `WINDY_KEY` stays server-only.
**Attribution required when active:** "© Windy.com" — included in the
MapLibre raster source's `attribution` field, surfaced via
`maplibregl-ctrl-attrib`.

## OpenFreeMap (`hyperknot/openfreemap`)

**License:** permissive (MIT-ish). Tiles are served under the OSM ODbL.
**Purpose:** free, no-key vector tile hosting.
**What we use:** the dark style URL
`https://tiles.openfreemap.org/styles/dark` as our MapLibre base.
Attribution renders automatically through the MapLibre attribution
control (OSM contributors).

## NWS APIs (no repo — public service)

**Endpoints used:**
- `https://api.weather.gov/alerts/active` — active alerts (proxied
  through `api/alerts.ts` for User-Agent + 60s edge cache).
- `https://api.weather.gov/radar/stations` — NEXRAD inventory + RDA
  status (proxied through `api/stations.ts`).
- `https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/
  {service}/ImageServer/exportImage` — pre-rendered radar products
  (Base Velocity, SRV, Echo Tops, VIL) as georeferenced PNGs (proxied
  through `api/radar/nws-overlay.ts`).

**Attribution:** none required (public domain). User-Agent is required
by NWS; we set it from `NWS_USER_AGENT` env var.

## OpenStreetMap Nominatim

**Endpoint used:** `https://nominatim.openstreetmap.org/search` for
geocoding the search bar (proxied through `api/geocode.ts` for User-Agent
+ 600s edge cache).

**Usage policy:** ≤ 1 request per second per IP. Our debounce (350ms in
`useGeocode`) plus the edge cache keeps us well under that limit.
