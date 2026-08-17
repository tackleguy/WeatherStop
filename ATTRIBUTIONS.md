# Attributions

WeatherStop is MIT-licensed (see `LICENSE`). It bundles open-source
software and consumes public weather data services. This file lists the
upstream sources and the licenses under which they are redistributed.

## Data sources

All sources are public and require attribution but no API key in the
default configuration. Attribution strings are surfaced in the in-app
attribution chip and the map's `attributionControl`.

| Source | Use | Terms |
| --- | --- | --- |
| **NOAA / NWS** — api.weather.gov | Forecasts, alerts, radar imagery | Public domain (US Government work, 17 U.S.C. § 105). Identify yourself with a `User-Agent`. |
| **NOAA / SPC** — spc.noaa.gov / mapservices.weather.noaa.gov | Convective outlooks (Day 1–8) + fire weather outlooks | Public domain. Cite "NOAA / Storm Prediction Center". |
| **NOAA / NWS RIDGE WMS** — opengeo.ncep.noaa.gov | Per-site reflectivity / velocity overlays | Public domain. Cite "NOAA / NWS". |
| **NOAA NEXRAD Level 2** — `noaa-nexrad-level2` AWS Open Data bucket | Storm-scale radar (server-rendered) | Public domain. Bucket is part of the NOAA Big Data Program. |
| **Unidata NEXRAD Level 3** — `unidata-nexrad-level3` AWS Open Data | Storm-relative velocity / rotation / CC (server-rendered) | Public domain. Cite "NOAA / Unidata". |
| **Supercell Wx** — [supercellwx.net](https://supercellwx.net/) / [dpaulat/supercell-wx](https://github.com/dpaulat/supercell-wx) | Companion desktop radar (inspiration; tiny in-app download/docs links) | MIT. We do **not** redistribute the desktop binary. In-app radar uses the same public NOAA NEXRAD Open Data streams Supercell visualizes. |
| **NASA GIBS** — gibs.earthdata.nasa.gov | GOES IR / visible satellite WMTS | Free public imagery; cite NASA GIBS / GOES. |
| **NOAA / NHC** — mapservices.weather.noaa.gov tropical | Tropical cones, tracks, watches, GTWO | Public domain. Cite "NOAA / National Hurricane Center". |
| **Open-Meteo** — api.open-meteo.com | Home/forecast cards, model compare | CC BY 4.0 (`https://open-meteo.com/en/license`). Attribution shown in-app. |
| **Earth Nullschool** — earth.nullschool.net | Wind / temperature / rain map visualization (embedded deep-link) | Proprietary visualization © Nullschool Technologies Inc. We deep-link/embed only; do not redistribute their app. Contact `inquiries@nullschool.net` for commercial licensing. Data shown is primarily GFS / NOAA (public). |
| **RainViewer** — tilecache.rainviewer.com | Global radar / satellite raster tiles | Free for non-commercial use; attribution required (`https://www.rainviewer.com/api.html`). |
| **Iowa State Mesonet** — mesonet.agron.iastate.edu | NEXRAD CONUS composite tiles | Free with attribution (`https://mesonet.agron.iastate.edu/`). |
| **OpenFreeMap** — tiles.openfreemap.org | Vector basemap | Free; OpenStreetMap data © OpenStreetMap contributors (ODbL). |
| **OpenStreetMap** — overpass-api.de | Golf courses / hole geometry (Golf section) | ODbL; cite © OpenStreetMap contributors. |
| **Esri World Imagery** — server.arcgisonline.com | High-detail satellite basemap (Golf section) | Cite Esri, Maxar, Earthstar Geographics, and the GIS User Community. Terms: Esri attribution requirements. |
| **Windy Webcams** — api.windy.com/webcams | Live cameras card | Requires API key; non-commercial use. |

If you fork this project for commercial distribution, audit each source's
terms — RainViewer, Windy Webcams, and Earth Nullschool all restrict or
require a license for commercial use. Supercell Wx itself is MIT; follow
its project license if you redistribute that app.

## Bundled JavaScript dependencies

Production-dependency licenses are validated on every `npm run build`
via `scripts/verify-licenses.mjs`, which fails the build if any
non-permissive license appears. The allowed list is: MIT, ISC,
Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, CC-BY-3.0, CC-BY-4.0,
CC0-1.0, Unlicense, Python-2.0, WTFPL, BlueOak-1.0.0.

Notable runtime dependencies:

- **MapLibre GL JS** — BSD-3-Clause
- **React / React DOM** — MIT
- **React Router** — MIT
- **Framer Motion** — MIT
- **Lucide Icons** — ISC
- **Zustand** — MIT
- **SWR** — MIT
- **@napi-rs/canvas** — MIT (server-side PNG rendering for Level 2)
- **nexrad-level-2-data** — MIT (Level 2 binary parser)
- **@vercel/blob** — Apache-2.0 (cache for rendered Level 2 PNGs)

### Per-package overrides

Some transitive packages don't declare a license string in their
`package.json` even though their upstream source is permissive. Each
override in `scripts/verify-licenses.mjs` documents its evidence:

- `@mapbox/jsonlint-lines-primitives@2.0.2` — MIT (forked from
  `tmcw/jsonlint`, originally `zaach/jsonlint`, both MIT). See
  `https://github.com/tmcw/jsonlint/blob/master/LICENSE`.

## Trademarks

"NEXRAD", "NWS", and the NOAA seal are property of the United States
National Oceanic and Atmospheric Administration. WeatherStop is not
affiliated with or endorsed by NOAA. All other trademarks belong to
their respective owners.
