# WeatherStop Radar

Production-grade weather radar dashboard. AccuWeather-flavored dark
chrome (warm orange accent on midnight base), NEXRAD reflectivity +
velocity products, NWS active alerts, time-scrubber playback, geocoded
search.

## Stack

- Vite + React 18 + TypeScript (strict)
- Tailwind CSS + custom CSS variables (see `src/index.css`)
- MapLibre GL JS 4 (OpenFreeMap dark base)
- Zustand for app state (`src/store/useRadarStore.ts`)
- SWR for alert + station polling
- Framer Motion for panel animations
- Lucide React for icons

## Endpoints (Vercel Edge Functions)

| Path | Purpose |
|---|---|
| `/api/radar/windy` | Tile proxy — Windy radar / satellite / temp. WINDY_KEY only used server-side. |
| `/api/radar/nws-overlay` | NOAA mapservices ImageServer proxy — base velocity, SRV, echo tops, VIL. |
| `/api/radar/frames` | List of available scrub timestamps. |
| `/api/satellite/windy` | Convenience proxy for Windy satellite tiles. |
| `/api/alerts` | NWS active alerts, optional bbox filter, 60s edge cache. |
| `/api/stations` | NEXRAD inventory + RDA status, 5min edge cache. |
| `/api/geocode` | Nominatim proxy for search, 10min edge cache. |

## Run locally

```sh
cd radar
npm install
cp .env.local.example .env.local   # then fill in WINDY_KEY
vercel dev                          # SPA + edge functions on one port
# OR for SPA-only without functions
npm run dev                         # http://localhost:5174
```

`vercel dev` is required for the API routes — `npm run dev` only serves
the static frontend, so radar tiles will 404 without `vercel dev`.

## Deploy

```sh
vercel link
vercel env add WINDY_KEY        production
vercel env add NWS_USER_AGENT   production
vercel --prod
```

## Layout

Desktop:

```
┌──────────────────────────────────────────────────────────┐
│ ⚡ WeatherStop Radar    🔍 search        🔔 ⚙ ☰        │  44px TopBar
├────┬─────────────────────────────────────────┬───────────┤
│    │                                         │           │
│ ☁  │                                         │  ALERTS   │
│ 🌪 │             MAP CANVAS                  │  PANEL    │
│ 📡 │                                         │  320px    │
│    │                                ╔═══════╗│           │
│ 56 │                                ║LEGEND ║│           │
│    │                                ╚═══════╝│           │
├────┴─────────────────────────────────────────┴───────────┤
│ ◄ ▶ ◐──●─────── 4:18 PM · LIVE 🔴                       │  72px TimeScrubber
└──────────────────────────────────────────────────────────┘
```

Mobile (≤768px): top bar, horizontal product strip, map, time scrubber,
alerts panel below scrubber.

## Status

| Acceptance | Status |
|---|---|
| 1. Open at zoom 4 — Windy tiles visible | ✅ once `WINDY_KEY` is set |
| 2. WINDY_KEY never in client bundle | ✅ proxy is the only consumer |
| 3. Alerts as polygons + sorted right panel | ✅ |
| 4. Click alert → fly + highlight | ✅ |
| 5. Switch product in rail → layer refetches | ✅ |
| 6. Time scrubber drag updates timestamp | ✅ |
| 7. LIVE pulses red at latest frame | ✅ |
| 8. Mobile rail + bottom alerts | ⚠️ rail done; full bottom-sheet drag not yet |
| 9. Reduced-motion guard | ✅ via `@media (prefers-reduced-motion)` in `index.css` |
| 10. `npm run build` clean | ✅ verify with `cd radar && npm run build` |
| 11. Lighthouse ≥ 75 mobile | ⏳ untested without deploy URL |
| 12. REFERENCE_NOTES.md exists | ✅ `docs/REFERENCE_NOTES.md` |
| 13. `ref/` gitignored | ✅ |
| 14. No GPL strings in src/ or api/ | ✅ verify with the grep below |

```sh
grep -ri "GPL\|gnu general public" src/ api/ | grep -v node_modules
# (should return zero matches)
```

## Licensing

- All deps in `package.json` are MIT/Apache-2.0/BSD/ISC.
- supercell-wx (GPL-3.0) is **not** referenced, cloned, or read.
- Windy attribution is shown via the MapLibre attribution control any
  time a Windy-backed product is the active layer.
- OSM/OpenFreeMap attribution is shown automatically.
