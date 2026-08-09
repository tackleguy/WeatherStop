# WxLive — working weather radar MVP

A single HTML file. **Double-click it.** No install, no build step, no API keys, no accounts.

Everything it shows comes from free US government and public data sources.

---

## What works right now

| Layer | Source | Notes |
|---|---|---|
| Base reflectivity | NWS MRMS, 1 km quality-controlled | animates over the last hour |
| Composite reflectivity | NWS MRMS | column maximum |
| Animated radar | RainViewer | smoothest loop, includes short-range forecast frames |
| Echo tops | NWS MRMS | storm height |
| Precipitation type | NWS MRMS | rain / snow / ice / mix |
| Site reflectivity | NWS per-radar GeoServer | super-resolution, single station |
| **Base velocity** | NWS per-radar GeoServer | green toward radar, red away |
| Hydrometeor classification | NWS per-radar GeoServer | dual-pol precip type per pixel |
| 1-hour rainfall / storm total | NWS per-radar GeoServer | accumulation |
| Infrared satellite | GOES via RainViewer | cloud-top temperature, animated |
| Temperature | Open-Meteo | live grid, interpolated across the view |
| Wind barbs | Open-Meteo | proper meteorological barbs in knots |
| Watches & warnings | api.weather.gov | official NWS polygons, official colors |
| Click anywhere | Open-Meteo | current conditions at that point |

Plus: automatic nearest-radar selection as you pan, a shared animation timeline, opacity control, three basemaps, a diagnostics panel that shows exactly which layers are loading and which are failing, and a reset button.

---

## What is deliberately *not* here

Four layers are shown greyed out with a **server** badge. They are not broken and they are not fake — they physically cannot run in a static HTML file:

- **Correlation coefficient**
- **Differential reflectivity (ZDR)**
- **Storm-relative velocity**
- **Rotation / azimuthal shear**

NOAA publishes these only as raw binary files (NEXRAD Level III and MRMS GRIB2). They have to be downloaded and decoded by a server, then turned into images, before a browser can show them. Nobody publishes them as free ready-made map tiles.

The master prompt (`MASTER-PROMPT.md`) tells a coding agent exactly how to build that piece, including which files to fetch and which decoding library to use.

---

## Why this exists

Two reasons:

1. **It proves the data sources work.** If your site is broken and this file isn't, the problem is in your site's code, not in NOAA's servers. That eliminates most of the guesswork.
2. **It's a reference implementation.** Every layer here is wired up correctly. The master prompt tells your coding agent to copy the working patterns out of this file rather than reinvent them.

---

## The two settings that black out a map

This is the mistake that broke the previous attempt, and it's worth understanding because it will come up again.

When you ask a NOAA map server for a radar image, you must tell it two things:

```
TRANSPARENT=TRUE      ← the "no data" areas become see-through
FORMAT=image/png      ← PNG supports transparency; JPEG does not
```

`TRANSPARENT` defaults to **false**. Leave it out and the server returns a solid black rectangle for every tile. Those tiles cover the entire map. Nothing errors, nothing appears in the console — the map just goes black.

In this file, that's handled in one place, in `mkWMS()`:

```js
format: 'image/png',
transparent: true,     // <-- without this the tile is opaque
```

Every WMS layer goes through that function, so the mistake can't be made twice.

---

## The other things that make maps go black

Built into this file as defences, worth copying into any weather map:

- **Dedicated layer panes.** Satellite, radar, surface data and warnings each get their own stacking level, so a weather layer can never be drawn underneath the basemap and warnings are always on top of radar.
- **The basemap is never removed.** When switching basemaps the new one is added *before* the old one is removed, so there is never a frame with no map. Every layer toggle re-checks that a basemap is present.
- **Every layer fails alone.** Each layer's setup is wrapped in error handling. A dead source removes itself and shows a message; it cannot take down the page.
- **A reset button** that clears everything back to a plain basemap.
- **`invalidateSize()` on resize and on tab focus.** A map container that is zero pixels tall renders black; this catches the common cases.
- **A diagnostics panel** counting loaded vs. failed tiles per layer, with the failing URL. When something breaks, this tells you *which* thing broke.

---

## Notes on the sources

- **`api.weather.gov` requires a User-Agent header.** Browsers send one automatically, so alerts work here. Any *server* code you write must set one explicitly in NOAA's requested format (`(yoursite.com, you@email.com)`) or you get a 403.
- **Radar site workspaces** on NOAA's GeoServer are named by the lowercase 4-letter station id — `ktlx`, `kfws`, `kokx`. The site list is bundled as a fallback and refreshed from Iowa State at load.
- **The time slider** works by sending timestamps on a clean 5-minute ladder. NOAA's radar layers are configured with `nearestValue=1`, meaning any timestamp is snapped to the closest real scan — so there's no need to fetch a capabilities document first.
- **RainViewer caps radar tiles around zoom 9–10.** The layer is set to upscale beyond that rather than request tiles that don't exist.
- **Open-Meteo** accepts many coordinates in a single request, which is how the temperature field and wind barbs are built without a server.

---

## Testing

`smoketest.js` runs the whole UI in a headless browser with the network cut off and a stubbed map library. It toggles every layer on and off, cycles basemaps, runs the animation, and fails if anything throws.

```
npm install playwright
node smoketest.js
```

It caught two real bugs while this was being built: a crash from reading a variable before it was declared, and two floating panels that were covering buttons and making them unclickable.

---

## Files

```
app.html        the whole application
README.md       this file
smoketest.js    automated UI test
MASTER-PROMPT.md  instructions for porting this into a real site
```

Attribution required by the sources used: NOAA/NWS, Iowa Environmental Mesonet, RainViewer, Open-Meteo, OpenStreetMap and CARTO. All are already in the map's attribution line.
