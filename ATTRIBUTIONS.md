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
| **NOAA / NWS RIDGE WMS** — opengeo.ncep.noaa.gov | Per-site reflectivity / velocity overlays | Public domain. Cite "NOAA / NWS". |
| **NOAA NEXRAD Level 2** — `noaa-nexrad-level2` AWS Open Data bucket | Storm-scale radar (server-rendered) | Public domain. Bucket is part of the NOAA Big Data Program. |
| **Open-Meteo** — api.open-meteo.com | Forecast data outside the US | CC BY 4.0 (`https://open-meteo.com/en/license`). Attribution shown in the home view. |
| **RainViewer** — tilecache.rainviewer.com | Global radar / satellite raster tiles | Free for non-commercial use; attribution required (`https://www.rainviewer.com/api.html`). |
| **Iowa State Mesonet** — mesonet.agron.iastate.edu | NEXRAD CONUS composite tiles | Free with attribution (`https://mesonet.agron.iastate.edu/`). |
| **OpenFreeMap** — tiles.openfreemap.org | Vector basemap | Free; OpenStreetMap data © OpenStreetMap contributors (ODbL). |
| **Windy Webcams** — api.windy.com/webcams | Live cameras card | Requires API key; non-commercial use. |

If you fork this project for commercial distribution, audit each source's
terms — RainViewer and Windy Webcams both restrict commercial use.

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
