// Famous storm-chaser catalog. Live positions only appear when a public
// feed URL or APRS callsign (+ APRS_API_KEY) is configured — we never invent GPS.

export interface FamousChaser {
  id: string;
  name: string;
  team: string;
  vehicle?: string;
  /** Env var name holding a JSON/GeoJSON feed URL. */
  feedEnv?: string;
  /** Env var name holding an APRS callsign. */
  aprsEnv?: string;
  /** Optional default APRS callsign if publicly documented by the operator. */
  aprsCallsign?: string;
  notes: string;
  color: string;
}

/** Well-known chase personalities — positions require configured feeds. */
export const FAMOUS_CHASERS: FamousChaser[] = [
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
