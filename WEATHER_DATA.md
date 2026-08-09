# Weather data sources (WeatherStop)

See also `RADAR_DATA_SOURCES.md` for the earlier mosaic/Level 2–3 notes.

## NOAA User-Agent

Server routes use `(weather-stop.vercel.app, contact@weatherstop.app)` by default.
Override with Vercel env `NWS_USER_AGENT`.

## Mandatory WMS parameters

Every OpenGeo GetMap goes through `api/_lib/opengeoWms.ts`:

- `FORMAT=image/png`
- `TRANSPARENT=true`
- `VERSION=1.3.0`
- `CRS=EPSG:3857`

Omitting transparency/PNG is what blacks out a map.

## Layers

| Layer | Source | URL / proxy | Cache | Fallback |
|-------|--------|-------------|-------|----------|
| Reflectivity | OpenGeo CONUS / Iowa / site | wms-site, iowa-state | 60–240s | RainViewer |
| Composite | `conus_cref_qcd` | wms-site `cref` | 60s | Iowa |
| Echo tops | `conus_neet_v18` | wms-site `neet` | 60s | — |
| Precip type | `conus_pcpn_typ` | wms-site `pcpn` | 60s | — |
| Velocity | Mosaic / site bvel / L2 | mosaic, wms-site | 60–90s | — |
| SRV / Rotation / CC | Level 3 (+ mosaic) | mosaic, level3 | 90–300s | L2 for CC |
| Hydrometeor | `{site}_bdhc` | wms-site | 60s | — |
| 1h / storm total | `{site}_boha` / `_bdsa` | wms-site | 60s | — |
| Satellite | Iowa GOES / GIBS | iowa-state, GIBS | 240s | — |
| Temp / wind | Open-Meteo | weather/grid | ~1h | — |
| Alerts | api.weather.gov | /api/alerts | short | — |

WMS TIME: scrubber sends ISO8601 `time=` (live frame omits it). OpenGeo uses `nearestValue=1`.
