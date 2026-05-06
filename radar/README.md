# WeatherStop Radar

Layered radar viewer that picks the best available source per zoom level
and focal point. Backbone is a MapLibre map on OpenFreeMap dark tiles.
Continental coverage from Windy, regional detail from NEXRAD Level III,
storm-scale detail from Level II — chosen automatically by the resolver.

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Reference notes (`docs/REFERENCE_NOTES.md`) | ✅ |
| 1 | OpenFreeMap base map + NWS active alerts (severity-tinted polygons, tornado pulse) | ✅ |
| 1 | Windy proxy edge function (`api/radar/windy.ts`) — needs `WINDY_KEY` env on Vercel | ✅ |
| 2 | NEXRAD via NOAA mapservices ImageServer (`api/radar/nexrad.ts` + `useNexradLayer`), debounced bbox refresh, opacity crossfade through zoom 7-8 | ✅ |
| 3 | Satellite via SSEC RealEarth raster tiles (`useSatelliteLayer`) — IR + visible, no key | ✅ |
| 4 | UX shell — collapsible product rail, time scrubber w/ LIVE pill, alerts inspector, station inventory modal, geocoded search bar, dBZ legend | ✅ |
| — | NEXRAD site list + nearest-site resolver (Phase 5 prep) | ✅ |
| 5 | Storm cell tracking from L3 STI product | ⏳ pending |

## Run locally

```sh
cd radar
npm install
npm run dev          # http://localhost:5174
```

The map, alerts polygons, alerts inspector, station modal, product rail,
and time scrubber all run without any keys. The Windy raster overlay
won't fetch tiles until you set `WINDY_KEY` and run via `vercel dev`
(needed for the edge function).

## Deploy

```sh
vercel link
vercel env add WINDY_KEY production
vercel --prod
```

`api/radar/windy.ts` and `api/alerts.ts` deploy as Edge Functions
automatically. The Vite app builds to `dist/` and is served as the SPA.

## Architecture

```
src/
├── App.tsx                              top-level shell
├── components/
│   ├── RadarMap.tsx                     MapLibre wrapper, alert polygons, layer manager
│   ├── ProductRail.tsx                  left rail (desktop) — product picker
│   ├── TimeScrubber.tsx                 60-min timeline, play/pause, scrub
│   ├── AlertsInspector.tsx              right rail (desktop) — alert list, fly-to
│   └── StationInventory.tsx             modal — 158 NEXRAD sites with NWS status ping
├── hooks/
│   ├── useAlerts.ts                     NWS /alerts/active poll, severity coloring
│   └── useRadarLayers.ts                zoom-aware MapLibre source/layer manager
├── lib/
│   ├── nexradSites.ts                   NEXRAD site list + nearestSite()
│   └── sourceResolver.ts                pickRadarSource(zoom, center, focused) → plan
└── constants/
    └── products.ts                      L3/L2 product table + reflectivity palette
```

## Source resolver rules

| Trigger | Source | Why |
|---|---|---|
| `focusedStorm` set (storm cell click) | L2 of nearest site | Lock storm-scale detail to the cell |
| Map zoom ≥ 11 | L2 of nearest site | 250 m gates show hooks/mesos |
| Map zoom 8–10 | L3 of nearest site | 230 km radial range, sharp at this scale |
| Map zoom < 8 | Windy continental composite | Smooth, prerendered, fast |

Each transition is meant to crossfade over 400 ms via paired MapLibre
raster sources. The Windy path is wired today; L3/L2 paths land in
phases 2–3.

## Reference repos (not vendored)

See `docs/REFERENCE_NOTES.md`. Run the clone commands at the bottom of
that file to drop them in `ref/` (gitignored) — useful for pulling
color tables and reading parsing strategies.

## Licensing

- Tiles: OpenFreeMap (permissive) → ODbL on the underlying OSM data.
- Radar overlays: NWS public domain (L3/L2/alerts/RIDGE), Windy
  commercial (free tier — attribution shown when their layer is active).
- supercell-wx: GPL-3.0. Used for **architecture inspiration only**, no
  code paste. Numeric color tables are not copyrightable.
