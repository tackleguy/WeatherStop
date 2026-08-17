// Multi-model wind ensemble + hole-by-hole golf brief.
// Aggregates Open-Meteo models (vector mean) and emits play tips.

export const config = { runtime: 'edge' };

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** Prefer high-skill globals + strong limited-area models from the app catalog. */
const ENSEMBLE_MODELS = [
  'gfs_seamless',
  'gfs_global',
  'gfs_hrrr',
  'gfs_graphcast025',
  'ecmwf_ifs025',
  'ecmwf_ifs',
  'ecmwf_aifs025_single',
  'icon_seamless',
  'icon_global',
  'icon_eu',
  'icon_d2',
  'gem_seamless',
  'gem_global',
  'gem_hrdps_continental',
  'meteofrance_seamless',
  'meteofrance_arpege_world',
  'ukmo_seamless',
  'ukmo_global_deterministic_10km',
  'jma_seamless',
  'jma_gsm',
  'cma_grapes_global',
  'bom_access_global',
  'kma_seamless',
  'knmi_seamless',
  'dmi_seamless',
];

interface HoleIn {
  number: number;
  yards: number;
  bearingDeg: number;
  par?: number;
  name?: string;
  teeElevationM?: number;
  greenElevationM?: number;
}

interface PlayerIn {
  handicap: number;
  miss: 'left' | 'right' | 'both' | 'straight';
  sevenIronYards: number;
  driverYards: number;
}

type WindAspect = 'head' | 'tail' | 'cross-L' | 'cross-R' | 'quarter-head' | 'quarter-tail';

interface HoleBrief {
  number: number;
  yards: number;
  bearingDeg: number;
  windFromDeg: number;
  windMph: number;
  gustMph: number;
  /** Positive = into the player, negative = helping. */
  headwindMph: number;
  /** Positive = pushes the ball right of the tee→green line. */
  crosswindMph: number;
  /** Estimated lateral drift at the green, yards; positive = right. */
  driftYards: number;
  /** Elevation adjustment in yards; positive = uphill. */
  slopeYards: number;
  elevationChangeFt: number;
  windAdjustmentYards: number;
  /** Wind + slope adjusted distance the hole plays to. */
  playsLikeYards: number;
  aspect: WindAspect;
  tip: string;
  clubHint: string;
  recommendedClub: string;
  modelAgreement: number;
}

function circMeanDeg(degs: number[]): number | null {
  if (!degs.length) return null;
  let sx = 0;
  let sy = 0;
  for (const d of degs) {
    const r = (d * Math.PI) / 180;
    sx += Math.cos(r);
    sy += Math.sin(r);
  }
  return (((Math.atan2(sy, sx) * 180) / Math.PI) + 360) % 360;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid]! : (a[mid - 1]! + a[mid]!) / 2;
}

function stdev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = nums.reduce((s, n) => s + n, 0) / nums.length;
  const v = nums.reduce((s, n) => s + (n - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

function angDiff(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

/**
 * `relDeg` is (wind from) − (hole bearing). Positive means the wind comes off
 * the player's right, which pushes the ball left.
 */
function aspectFor(relDeg: number): WindAspect {
  const a = Math.abs(relDeg);
  if (a <= 25) return 'head';
  if (a >= 155) return 'tail';
  if (a <= 65) return 'quarter-head';
  if (a >= 115) return 'quarter-tail';
  return relDeg > 0 ? 'cross-L' : 'cross-R';
}

function windAdjustment(headwindMph: number): number {
  // Roughly one club (~10 yd) per 6 mph, kept continuous for useful totals.
  return Math.round(headwindMph * (10 / 6));
}

function slopeFor(hole: HoleIn): {
  slopeYards: number;
  elevationChangeFt: number;
} {
  if (
    !Number.isFinite(hole.teeElevationM) ||
    !Number.isFinite(hole.greenElevationM)
  ) {
    return { slopeYards: 0, elevationChangeFt: 0 };
  }
  const deltaM = hole.greenElevationM! - hole.teeElevationM!;
  // Common playing rule: one yard of distance per yard of elevation change.
  return {
    slopeYards: Math.round(deltaM * 1.09361),
    elevationChangeFt: Math.round(deltaM * 3.28084),
  };
}

function bagFor(player: PlayerIn): Array<{ label: string; yards: number }> {
  const gap = Math.max(8, Math.min(14, player.sevenIronYards * 0.075));
  return [
    { label: 'Driver', yards: player.driverYards },
    { label: '3W', yards: Math.round(player.driverYards * 0.9) },
    { label: '5W', yards: Math.round(player.driverYards * 0.82) },
    { label: '4i', yards: Math.round(player.sevenIronYards + gap * 3) },
    { label: '5i', yards: Math.round(player.sevenIronYards + gap * 2) },
    { label: '6i', yards: Math.round(player.sevenIronYards + gap) },
    { label: '7i', yards: player.sevenIronYards },
    { label: '8i', yards: Math.round(player.sevenIronYards - gap) },
    { label: '9i', yards: Math.round(player.sevenIronYards - gap * 2) },
    { label: 'PW', yards: Math.round(player.sevenIronYards - gap * 3) },
    { label: 'GW', yards: Math.round(player.sevenIronYards - gap * 4) },
    { label: 'SW', yards: Math.max(45, Math.round(player.sevenIronYards - gap * 5)) },
  ];
}

function nearestClub(
  yards: number,
  player: PlayerIn,
): { label: string; yards: number } {
  return bagFor(player).reduce((best, club) =>
    Math.abs(club.yards - yards) < Math.abs(best.yards - yards) ? club : best,
  );
}

function clubPlan(
  hole: HoleIn,
  playsLikeYards: number,
  player: PlayerIn,
): { hint: string; recommended: string } {
  if ((hole.par ?? 3) <= 3 || playsLikeYards <= player.driverYards * 0.78) {
    const club = nearestClub(playsLikeYards, player);
    return {
      recommended: club.label,
      hint: `${club.label} stock ${club.yards} yd · plays ${playsLikeYards}`,
    };
  }

  const conservative = player.handicap >= 20 && hole.yards < player.driverYards * 1.55;
  const teeClub = conservative
    ? nearestClub(player.driverYards * 0.88, player)
    : { label: 'Driver', yards: player.driverYards };
  const remaining = Math.max(40, playsLikeYards - teeClub.yards);
  const approach = nearestClub(remaining, player);
  return {
    recommended: `${teeClub.label} → ${approach.label}`,
    hint: `${teeClub.label} ${teeClub.yards}, then ${approach.label} from ~${Math.round(remaining)} yd`,
  };
}

function tipFor(
  hole: HoleIn,
  aspect: WindAspect,
  windMph: number,
  head: number,
  cross: number,
  driftYards: number,
  slopeYards: number,
  player: PlayerIn,
  agreement: number,
): string {
  const conf =
    agreement >= 0.75
      ? 'Models agree'
      : agreement >= 0.5
        ? 'Models lean'
        : 'Models split';
  // cross > 0 pushes the ball right, so you aim left of the target.
  const pushSide = cross >= 0 ? 'right' : 'left';
  const aimSide = cross >= 0 ? 'left' : 'right';
  const crossAbs = Math.abs(cross);
  const driftAbs = Math.abs(Math.round(driftYards));
  const missAim =
    player.miss === 'right'
      ? 'Favor the left-center for your right miss.'
      : player.miss === 'left'
        ? 'Favor the right-center for your left miss.'
        : player.miss === 'both'
          ? 'Choose the widest target and avoid the short side.'
          : 'Use your normal start line.';
  const slope =
    Math.abs(slopeYards) >= 3
      ? ` It plays ${Math.abs(slopeYards)} yd ${slopeYards > 0 ? 'uphill' : 'downhill'}.`
      : '';

  if (windMph < 4) {
    return `${conf}: nearly calm on #${hole.number}.${slope} ${missAim}`;
  }

  let windTip: string;
  switch (aspect) {
    case 'head':
      windTip = `solid headwind (~${Math.round(head)} mph). Club up and flight it lower.`;
      break;
    case 'tail':
      windTip = `helping tailwind (~${Math.round(Math.abs(head))} mph). Expect extra release.`;
      break;
    case 'cross-L':
    case 'cross-R':
      windTip = `${Math.round(crossAbs)} mph crosswind pushes it ${pushSide} ~${driftAbs} yd; start ${aimSide}.`;
      break;
    case 'quarter-head':
      windTip = `quartering into you: ~${Math.round(head)} mph hold-up and ~${driftAbs} yd ${pushSide} drift.`;
      break;
    case 'quarter-tail':
      windTip = `quartering downwind with ~${driftAbs} yd ${pushSide} drift; start ${aimSide}.`;
      break;
  }
  return `${conf}: ${windTip}${slope} ${missAim}`;
}

async function fetchModelHour(
  lat: number,
  lon: number,
  model: string,
  hourIdx: number,
): Promise<{
  model: string;
  ok: boolean;
  speed?: number;
  dir?: number;
  gust?: number;
  time?: string;
  reason?: string;
}> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    models: model,
    timezone: 'auto',
    wind_speed_unit: 'mph',
    forecast_days: '2',
    timeformat: 'iso8601',
  });
  try {
    const res = await fetch(`${FORECAST_URL}?${params}`);
    const text = await res.text();
    const repaired = text
      .replace(/([:,[]\s*)-?nan\b/gi, '$1null')
      .replace(/([:,[]\s*)-?inf(inity)?\b/gi, '$1null');
    const data = JSON.parse(repaired) as {
      error?: boolean;
      reason?: string;
      latitude?: number | null;
      longitude?: number | null;
      hourly?: {
        time?: string[];
        wind_speed_10m?: (number | null)[];
        wind_direction_10m?: (number | null)[];
        wind_gusts_10m?: (number | null)[];
      };
    };
    if (!res.ok || data.error || data.latitude == null) {
      return { model, ok: false, reason: data.reason ?? `HTTP ${res.status}` };
    }
    const times = data.hourly?.time ?? [];
    const idx = Math.min(Math.max(hourIdx, 0), Math.max(0, times.length - 1));
    const speed = data.hourly?.wind_speed_10m?.[idx];
    const dir = data.hourly?.wind_direction_10m?.[idx];
    const gust = data.hourly?.wind_gusts_10m?.[idx];
    if (
      typeof speed !== 'number' ||
      !Number.isFinite(speed) ||
      typeof dir !== 'number' ||
      !Number.isFinite(dir)
    ) {
      return { model, ok: false, reason: 'no wind at hour' };
    }
    return {
      model,
      ok: true,
      speed,
      dir,
      gust: typeof gust === 'number' && Number.isFinite(gust) ? gust : speed,
      time: times[idx],
    };
  } catch (err) {
    return {
      model,
      ok: false,
      reason: err instanceof Error ? err.message : 'fetch failed',
    };
  }
}

export default async function handler(req: Request): Promise<Response> {
  let lat: number;
  let lon: number;
  let hour = 0;
  let holes: HoleIn[] = [];
  let player: PlayerIn = {
    handicap: 18,
    miss: 'right',
    sevenIronYards: 150,
    driverYards: 225,
  };

  if (req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as {
      lat?: number;
      lon?: number;
      hour?: number;
      holes?: HoleIn[];
      player?: PlayerIn;
    } | null;
    if (!body) {
      return new Response(JSON.stringify({ error: 'invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    lat = Number(body.lat);
    lon = Number(body.lon);
    hour = Number(body.hour ?? 0);
    holes = Array.isArray(body.holes) ? body.holes : [];
    if (
      body.player &&
      Number.isFinite(body.player.handicap) &&
      Number.isFinite(body.player.sevenIronYards) &&
      Number.isFinite(body.player.driverYards)
    ) {
      player = body.player;
    }
  } else {
    const sp = new URL(req.url).searchParams;
    lat = Number(sp.get('lat'));
    lon = Number(sp.get('lon'));
    hour = Number(sp.get('hour') ?? 0);
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return new Response(JSON.stringify({ error: 'lat and lon required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results = await Promise.all(
    ENSEMBLE_MODELS.map((m) => fetchModelHour(lat, lon, m, hour)),
  );
  const ok = results.filter((r) => r.ok && r.speed != null && r.dir != null);

  // Vector-mean wind (u/v) for a physically consistent ensemble direction.
  let u = 0;
  let v = 0;
  const speeds: number[] = [];
  const gusts: number[] = [];
  const dirs: number[] = [];
  for (const r of ok) {
    const rad = ((r.dir! + 180) * Math.PI) / 180; // toward vector
    u += r.speed! * Math.sin(rad);
    v += r.speed! * Math.cos(rad);
    speeds.push(r.speed!);
    gusts.push(r.gust ?? r.speed!);
    dirs.push(r.dir!);
  }
  const n = ok.length || 1;
  u /= n;
  v /= n;
  const ensSpeed = Math.hypot(u, v);
  const ensToward = ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360;
  const ensFrom = (ensToward + 180) % 360;
  const medSpeed = median(speeds) ?? ensSpeed;
  const medGust = median(gusts) ?? medSpeed;
  const circ = circMeanDeg(dirs) ?? ensFrom;
  const dirSpread = stdev(dirs.map((d) => angDiff(d, circ)));
  const spdSpread = stdev(speeds);
  const agreement = Math.max(
    0,
    Math.min(1, 1 - dirSpread / 90 - spdSpread / 25),
  );

  const windFrom = ensFrom;
  const windMph = ensSpeed || medSpeed;
  const gustMph = Math.max(medGust, windMph);

  const briefs: HoleBrief[] = holes.map((hole) => {
    const rel = angDiff(windFrom, hole.bearingDeg);
    const rad = (rel * Math.PI) / 180;
    const headwindMph = windMph * Math.cos(rad);
    // Negated so positive means "pushes the ball right of the target line".
    const crosswindMph = -windMph * Math.sin(rad);
    // ~10 mph of cross over 200 yds ≈ 24 yds of drift.
    const driftYards = crosswindMph * (hole.yards / 100) * 1.2;
    const windAdjustmentYards = windAdjustment(headwindMph);
    const { slopeYards, elevationChangeFt } = slopeFor(hole);
    const playsLikeYards = Math.max(
      40,
      Math.round(hole.yards + windAdjustmentYards + slopeYards),
    );
    const plan = clubPlan(hole, playsLikeYards, player);
    const aspect = aspectFor(rel);
    return {
      number: hole.number,
      yards: hole.yards,
      bearingDeg: hole.bearingDeg,
      windFromDeg: Math.round(windFrom),
      windMph: Math.round(windMph * 10) / 10,
      gustMph: Math.round(gustMph * 10) / 10,
      headwindMph: Math.round(headwindMph * 10) / 10,
      crosswindMph: Math.round(crosswindMph * 10) / 10,
      driftYards: Math.round(driftYards),
      slopeYards,
      elevationChangeFt,
      windAdjustmentYards,
      playsLikeYards,
      aspect,
      tip: tipFor(
        hole,
        aspect,
        windMph,
        headwindMph,
        crosswindMph,
        driftYards,
        slopeYards,
        player,
        agreement,
      ),
      clubHint: plan.hint,
      recommendedClub: plan.recommended,
      modelAgreement: Math.round(agreement * 100) / 100,
    };
  });

  const summary =
    ok.length === 0
      ? 'No models returned wind for this location/hour.'
      : `Ensemble of ${ok.length} models: ${Math.round(windMph)} mph from ${Math.round(windFrom)}°` +
        (gustMph > windMph + 3 ? ` (gusts ${Math.round(gustMph)})` : '') +
        `. Agreement ${Math.round(agreement * 100)}%.` +
        (briefs.length
          ? ` Hole-by-hole tips use each hole’s tee→green bearing vs ensemble wind.`
          : '');

  return new Response(
    JSON.stringify({
      lat,
      lon,
      hour,
      time: ok[0]?.time ?? null,
      ensemble: {
        windFromDeg: Math.round(windFrom),
        windMph: Math.round(windMph * 10) / 10,
        gustMph: Math.round(gustMph * 10) / 10,
        agreement: Math.round(agreement * 100) / 100,
        modelsUsed: ok.map((r) => r.model),
        modelsFailed: results.filter((r) => !r.ok).map((r) => ({
          model: r.model,
          reason: r.reason,
        })),
      },
      summary,
      holes: briefs,
      attribution: 'Open-Meteo multi-model ensemble (CC BY 4.0)',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    },
  );
}
