# Radar & weather data sources

How WeatherStop loads each map layer. All sources are free / no API key
(except optional server-only `WINDY_KEY`, which is unused by the default
product rail).

## If something breaks later — check these first

1. Run `npm run check-endpoints` and read which probe failed.
2. Hard-refresh the PWA (service worker cache is `weatherstop-v5`).
3. Confirm you are over the US for VEL / SRV / ROT / CC (CONUS NEXRAD only).
4. For blank CC at close zoom: Level 2 must read `record.rho` directly —
   the npm `getHighresCorrelationCoefficient(scan)` helper is buggy.
5. RainViewer `satellite.infrared` is often an empty array — IR must come
   from Iowa GOES or NASA GIBS, not RainViewer.
6. OpenGeo WMS needs `CRS=EPSG:3857` (web mercator), not 4326.
7. `api.weather.gov` needs a `User-Agent` (set in `/api/alerts` and related proxies).

---

## Layer → source

| Layer | Primary | Proxy? | Update | Cache | Fallback |
|-------|---------|--------|--------|-------|----------|
| Reflectivity (z≤9) | OpenGeo `conus:conus_bref_qcd` | `/api/radar/wms-site?site=conus&product=bref` | ~2–5 min | 120s | Iowa N0Q XYZ |
| Reflectivity (z≤11) | Iowa `nexrad-n0q-900913` | `/api/radar/iowa-state` | ~5 min | 240s | RainViewer radar |
| Reflectivity (close) | OpenGeo site `*_sr_bref` → Level 2 | wms-site / level2 | ~5 min | 300s | Iowa |
| Composite | OpenGeo `conus:conus_cref_qcd` | wms-site `product=cref` | ~2–5 min | 120s | Iowa N0Q |
| Base velocity (wide) | Multi-site OpenGeo `*_sr_bvel` mosaic | `/api/radar/mosaic?product=bvel` | ~2–5 min | 90s | Single-site WMS |
| Base velocity (close) | Site WMS / Level 2 | wms-site / level2 | ~5 min | 120–300s | — |
| Storm-rel velocity | Level 3 N0S (Unidata S3) mosaic → single site | mosaic / level3 | ~5 min | 90–300s | — |
| Rotation | Azimuthal shear from N0S | mosaic `rot` / level3 `ROT` | ~5 min | 90–300s | — |
| Correlation (wide) | Level 3 N0C mosaic | mosaic `n0c` | ~5 min | 90s | Single-site L3 |
| Correlation (close) | Level 3 N0C → Level 2 rho | level3 / level2 | ~5 min | 300s | — |
| Satellite IR (US) | Iowa GOES IR XYZ | iowa-state `goes-*-ir-4km-900913` | ~5–15 min | 240s | NASA GIBS Band 13 |
| Satellite VIS (US) | Iowa GOES VIS XYZ | iowa-state `goes-*-vis-1km-900913` | day only | 240s | NASA GIBS Band 2 |
| Satellite (global) | NASA GIBS WMTS | direct (CORS OK) | NRT | browser | — |
| Temperature | Open-Meteo grid → PNG | `/api/weather/grid?layer=temperature` | hourly | ~1h window | — |
| Wind | Open-Meteo grid → PNG | `/api/weather/grid?layer=wind` | hourly | ~1h window | — |
| Alerts | `api.weather.gov/alerts/active` | `/api/alerts` | continuous | short | — |

## Why a proxy?

- **CORS / binary decode:** Level 2 / Level 3 NEXRAD files cannot be decoded in the browser; mosaics composite many site images server-side.
- **Allowlist:** Proxies only hit known NOAA / Iowa / Unidata / Open-Meteo hosts.
- **Cache:** Edge / `Cache-Control` cuts repeat load on pan/zoom.

## Exact URL patterns

```
# Iowa XYZ
https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/{product}/{z}/{x}/{y}.png

# OpenGeo WMS (via our proxy)
/api/radar/wms-site?site={icao|conus}&product={bref|bvel|cref}&bbox={3857}&width=&height=

# Multi-site mosaic
/api/radar/mosaic?product={bvel|n0s|rot|n0c}&bbox={3857}&width=&height=

# Level 3 / 2
/api/radar/level3?site={ICAO}&product={N0S|ROT|N0C}
/api/radar/level2?site={ICAO}&product={reflectivity|velocity|correlation}

# Open-Meteo tiles
/api/weather/grid?z={z}&x={x}&y={y}&layer={temperature|wind}
```

Upstream Level 3 files: `https://unidata-nexrad-level3.s3.amazonaws.com/{SITE3}_{CODE}_...`  
Upstream Level 2 files: `https://unidata-nexrad-level2.s3.amazonaws.com/{YYYY}/{MM}/{DD}/{SITE}/...`
