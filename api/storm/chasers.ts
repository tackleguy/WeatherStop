// Famous storm-chaser positions for Chase mode.
// Catalog is public; live GPS only when feed/APRS env (or ?feeds=) is set.

import {
  fetchAprsFix,
  parsePositionFeed,
  type ChaserFix,
} from './_lib/chaserFix.js';

export const config = { runtime: 'edge' };

interface CatalogEntry {
  id: string;
  name: string;
  team: string;
  vehicle?: string;
  feedEnv?: string;
  aprsEnv?: string;
  aprsCallsign?: string;
  notes: string;
  color: string;
}

// Keep in sync with src/lib/famousChasers.ts
const CATALOG: CatalogEntry[] = [
  {
    id: 'reed-timmer',
    name: 'Reed Timmer',
    team: 'Team Dominator',
    vehicle: 'Dominator 3',
    feedEnv: 'DOM3_FEED_URL',
    aprsEnv: 'DOM3_APRS_CALL',
    notes: 'Dom 3 intercept science / livestreams',
    color: '#f59e0b',
  },
  {
    id: 'skip-talbot',
    name: 'Skip Talbot',
    team: 'Skip Talbot',
    feedEnv: 'CHASER_SKIP_TALBOT_FEED',
    aprsEnv: 'CHASER_SKIP_TALBOT_APRS',
    notes: 'Classic structure photography chases',
    color: '#38bdf8',
  },
  {
    id: 'pecos-hank',
    name: 'Pecos Hank',
    team: 'Pecos Hank',
    feedEnv: 'CHASER_PECOS_HANK_FEED',
    aprsEnv: 'CHASER_PECOS_HANK_APRS',
    notes: 'IMAX / viral tornado footage',
    color: '#a78bfa',
  },
  {
    id: 'brandon-clement',
    name: 'Brandon Clement',
    team: 'Brandon Clement',
    feedEnv: 'CHASER_BRANDON_CLEMENT_FEED',
    aprsEnv: 'CHASER_BRANDON_CLEMENT_APRS',
    notes: 'Storm video / drone work',
    color: '#34d399',
  },
  {
    id: 'mike-olbinado',
    name: 'Mike Olbinado',
    team: 'Basehunters',
    feedEnv: 'CHASER_BASEHUNTERS_FEED',
    aprsEnv: 'CHASER_BASEHUNTERS_APRS',
    notes: 'Basehunters chase team',
    color: '#fb7185',
  },
  {
    id: 'jordan-fish',
    name: 'Jordan Fish',
    team: 'Convective Addiction',
    feedEnv: 'CHASER_CONVECTIVE_FEED',
    aprsEnv: 'CHASER_CONVECTIVE_APRS',
    notes: 'Convective Addiction media',
    color: '#f472b6',
  },
  {
    id: 'ryan-shepard',
    name: 'Ryan Shepard',
    team: 'Ryan Shepard',
    feedEnv: 'CHASER_RYAN_SHEPARD_FEED',
    aprsEnv: 'CHASER_RYAN_SHEPARD_APRS',
    notes: 'Plains chasing / photography',
    color: '#2dd4bf',
  },
  {
    id: 'james-spinardi',
    name: 'James Spinardi',
    team: 'James Spinardi',
    feedEnv: 'CHASER_SPINARDI_FEED',
    aprsEnv: 'CHASER_SPINARDI_APRS',
    notes: 'Storm media / intercepts',
    color: '#e879f9',
  },
];

const DISCLAIMER =
  'Chaser positions only appear from public/licensed feeds you configure. Not affiliated with any chase team. Never drive into tornado warnings to follow someone.';

function env(name?: string): string | undefined {
  if (!name) return undefined;
  const v = process.env[name]?.trim();
  return v || undefined;
}

/** Optional JSON map id→feedUrl from CHASER_FEED_URLS or ?feeds= */
function extraFeeds(raw: string | null): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const overrides = {
    ...extraFeeds(process.env.CHASER_FEED_URLS ?? null),
    ...extraFeeds(searchParams.get('feeds')),
  };
  const aprsKey = process.env.APRS_API_KEY?.trim();

  const chasers: ChaserFix[] = await Promise.all(
    CATALOG.map(async (c) => {
      const feed =
        overrides[c.id] ||
        (c.id === 'reed-timmer'
          ? searchParams.get('dom3Feed')?.trim()
          : undefined) ||
        env(c.feedEnv);
      const callsign = env(c.aprsEnv) || c.aprsCallsign;

      if (feed) {
        try {
          const fix = await parsePositionFeed(feed, c.name);
          if (fix?.available) {
            return {
              id: c.id,
              available: true,
              label: fix.label || c.name,
              team: c.team,
              vehicle: c.vehicle,
              lat: fix.lat,
              lon: fix.lon,
              heading: fix.heading,
              speedMph: fix.speedMph,
              updatedAt: fix.updatedAt,
              source: fix.source,
              color: c.color,
              trail: fix.trail,
              notes: c.notes,
            } satisfies ChaserFix;
          }
        } catch {
          // fall through
        }
      }

      if (callsign && aprsKey) {
        try {
          const fix = await fetchAprsFix(callsign, aprsKey, c.name);
          if (fix?.available) {
            return {
              id: c.id,
              available: true,
              label: fix.label || c.name,
              team: c.team,
              vehicle: c.vehicle,
              lat: fix.lat,
              lon: fix.lon,
              heading: fix.heading,
              speedMph: fix.speedMph,
              updatedAt: fix.updatedAt,
              source: fix.source,
              color: c.color,
              notes: c.notes,
            } satisfies ChaserFix;
          }
        } catch {
          // fall through
        }
      }

      return {
        id: c.id,
        available: false,
        label: c.name,
        team: c.team,
        vehicle: c.vehicle,
        color: c.color,
        notes: c.notes,
        error: feed || callsign
          ? 'Feed/APRS lookup returned no fix'
          : 'No feed configured',
      } satisfies ChaserFix;
    }),
  );

  const live = chasers.filter((c) => c.available).length;

  return new Response(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      liveCount: live,
      chasers,
      disclaimer: DISCLAIMER,
      attribution: 'Organic Maps-friendly chase overlays · OSM road network via OSRM preview',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=20, s-maxage=20',
      },
    },
  );
}
