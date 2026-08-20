// Rule-based storm brief composer. Grounded only in NWS alert text/geometry —
// never invents warnings. Optional LLM polish happens in the route handler.

import { NWS_USER_AGENT } from '../../_lib/nwsUa.js';

export type StormDanger = 'extreme' | 'high' | 'moderate' | 'low';

export interface TrackedStorm {
  id: string;
  event: string;
  type: string;
  danger: StormDanger;
  area: string;
  headline: string;
  expires: string;
  center?: [number, number];
  motionBearing?: number;
  motionMph?: number;
  motionLabel?: string;
}

export interface StormBrief {
  generatedAt: string;
  source: 'nws' | 'nws+ai';
  headline: string;
  summary: string;
  threats: string[];
  actions: string[];
  storms: TrackedStorm[];
  alertCount: number;
  severeCount: number;
  disclaimer: string;
}

interface NwsFeature {
  id?: string;
  geometry?: GeoJSON.Geometry | null;
  properties?: Record<string, unknown>;
}

const DIRECTION_BEARINGS: Record<string, number> = {
  N: 0,
  NORTH: 0,
  NNE: 22.5,
  NE: 45,
  NORTHEAST: 45,
  ENE: 67.5,
  E: 90,
  EAST: 90,
  ESE: 112.5,
  SE: 135,
  SOUTHEAST: 135,
  SSE: 157.5,
  S: 180,
  SOUTH: 180,
  SSW: 202.5,
  SW: 225,
  SOUTHWEST: 225,
  WSW: 247.5,
  W: 270,
  WEST: 270,
  WNW: 292.5,
  NW: 315,
  NORTHWEST: 315,
  NNW: 337.5,
};

function compassFromBearing(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
}

function coordinatesOf(geometry: GeoJSON.Geometry): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const walk = (value: unknown) => {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      points.push([value[0], value[1]]);
      return;
    }
    if (Array.isArray(value)) value.forEach(walk);
  };
  if ('coordinates' in geometry) walk(geometry.coordinates);
  return points;
}

function geometryCenter(
  geometry: GeoJSON.Geometry | null | undefined,
): [number, number] | undefined {
  if (!geometry) return undefined;
  const points = coordinatesOf(geometry);
  if (!points.length) return undefined;
  return [
    points.reduce((sum, p) => sum + p[0], 0) / points.length,
    points.reduce((sum, p) => sum + p[1], 0) / points.length,
  ];
}

function parseMotion(text: string): {
  bearing?: number;
  mph?: number;
  label?: string;
} {
  const match = text
    .toUpperCase()
    .match(
      /MOV(?:ING|EMENT)?\s+(?:TOWARD\s+THE\s+)?(NORTH(?:EAST|WEST)?|SOUTH(?:EAST|WEST)?|EAST|WEST|NNE|ENE|ESE|SSE|SSW|WSW|WNW|NNW|NE|SE|SW|NW|N|E|S|W)\s+(?:AT|AROUND)\s+(\d{1,3})\s*MPH/,
    );
  if (!match) return {};
  const bearing = DIRECTION_BEARINGS[match[1]!];
  const mph = Number(match[2]);
  if (bearing == null || !Number.isFinite(mph)) return {};
  return {
    bearing,
    mph,
    label: `Moving ${compassFromBearing(bearing)} at ${mph} mph`,
  };
}

function dangerFor(event: string, severity: string): StormDanger {
  if (/tornado/i.test(event)) return 'extreme';
  if (/severe thunderstorm|hurricane|tropical storm/i.test(event)) return 'high';
  const s = severity.toLowerCase();
  if (s === 'extreme') return 'extreme';
  if (s === 'severe') return 'high';
  if (s === 'moderate') return 'moderate';
  return 'low';
}

function typeFor(event: string): string {
  if (/tornado/i.test(event)) return 'Tornado';
  if (/severe thunderstorm/i.test(event)) return 'Severe thunderstorm';
  if (/hurricane/i.test(event)) return 'Hurricane';
  if (/tropical storm/i.test(event)) return 'Tropical storm';
  if (/flash flood/i.test(event)) return 'Flash flood';
  return event;
}

function isTrackable(event: string): boolean {
  return /tornado|severe thunderstorm|hurricane|tropical storm|flash flood/i.test(
    event,
  );
}

export function featuresToStorms(features: NwsFeature[]): TrackedStorm[] {
  const storms: TrackedStorm[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const event = String(p.event ?? 'Alert');
    if (!isTrackable(event)) continue;
    const headline = String(p.headline ?? '');
    const description = String(p.description ?? '');
    const motion = parseMotion(`${headline}\n${description}`);
    const severity = String(p.severity ?? '');
    storms.push({
      id: String(f.id ?? `${event}-${storms.length}`),
      event,
      type: typeFor(event),
      danger: dangerFor(event, severity),
      area: String(p.areaDesc ?? ''),
      headline,
      expires: String(p.expires ?? ''),
      center: geometryCenter(f.geometry),
      motionBearing: motion.bearing,
      motionMph: motion.mph,
      motionLabel: motion.label,
    });
  }
  const rank: Record<StormDanger, number> = {
    extreme: 4,
    high: 3,
    moderate: 2,
    low: 1,
  };
  return storms.sort((a, b) => rank[b.danger] - rank[a.danger]);
}

export function composeStormBrief(
  features: NwsFeature[],
  opts?: { placeLabel?: string },
): StormBrief {
  const storms = featuresToStorms(features);
  const alertCount = features.length;
  const severeCount = features.filter((f) => {
    const sev = String(f.properties?.severity ?? '').toLowerCase();
    const event = String(f.properties?.event ?? '');
    return (
      sev === 'extreme' ||
      sev === 'severe' ||
      /tornado|severe thunderstorm/i.test(event)
    );
  }).length;

  const place = opts?.placeLabel?.trim() || 'this view';
  const tornadoes = storms.filter((s) => /tornado/i.test(s.event));
  const severe = storms.filter((s) => /severe thunderstorm/i.test(s.event));
  const floods = storms.filter((s) => /flash flood/i.test(s.event));
  const tropical = storms.filter((s) =>
    /hurricane|tropical storm/i.test(s.event),
  );

  const threats: string[] = [];
  if (tornadoes.length) {
    threats.push(
      `${tornadoes.length} tornado warning${tornadoes.length === 1 ? '' : 's'} — highest priority`,
    );
  }
  if (severe.length) {
    threats.push(
      `${severe.length} severe thunderstorm warning${severe.length === 1 ? '' : 's'}`,
    );
  }
  if (floods.length) {
    threats.push(
      `${floods.length} flash-flood threat${floods.length === 1 ? '' : 's'}`,
    );
  }
  if (tropical.length) {
    threats.push(
      `${tropical.length} tropical system hazard${tropical.length === 1 ? '' : 's'}`,
    );
  }
  if (!threats.length && alertCount) {
    threats.push(`${alertCount} active NWS alert${alertCount === 1 ? '' : 's'} in range`);
  }
  if (!threats.length) {
    threats.push('No severe convective warnings in this viewport right now');
  }

  const moving = storms.filter((s) => s.motionLabel);
  if (moving.length) {
    const sample = moving
      .slice(0, 3)
      .map((s) => `${s.type}: ${s.motionLabel}`)
      .join('; ');
    threats.push(`Motion from NWS text — ${sample}`);
  }

  const actions: string[] = [];
  if (tornadoes.length) {
    actions.push('If under a tornado warning: get to an interior room on the lowest floor now');
  }
  if (severe.length) {
    actions.push('Secure outdoor items; expect damaging wind and large hail in warned counties');
  }
  if (floods.length) {
    actions.push('Avoid flooded roads — turn around, don’t drown');
  }
  if (!actions.length && storms.length) {
    actions.push('Monitor official NWS polygons on the map and local emergency managers');
  }
  if (!actions.length) {
    actions.push('Keep radar and alerts open — conditions can change quickly');
  }
  actions.push('This helper summarizes official products; it is not a substitute for NWS warnings');

  let headline: string;
  let summary: string;
  if (tornadoes.length) {
    headline = `Tornado threat active near ${place}`;
    summary = `Tracker sees ${tornadoes.length} tornado warning${tornadoes.length === 1 ? '' : 's'} plus ${severeCount} severe-tier product${severeCount === 1 ? '' : 's'} in ${place}. Follow the red/purple polygons and any storm motion vectors on the map.`;
  } else if (severe.length) {
    headline = `Severe storms tracking near ${place}`;
    summary = `${severe.length} severe thunderstorm warning${severe.length === 1 ? '' : 's'} are active. Circles mark warned cells; arrows (when NWS text includes motion) show the next ~60 minutes of movement.`;
  } else if (tropical.length) {
    headline = `Tropical hazards near ${place}`;
    summary = `Tropical products are in play. Use the tropical layer for official NHC tracks alongside these warnings.`;
  } else if (alertCount) {
    headline = `Weather alerts near ${place}`;
    summary = `${alertCount} active NWS alert${alertCount === 1 ? '' : 's'} in view. No tornado or severe thunderstorm warnings are currently flagged by the tracker.`;
  } else {
    headline = `Quiet for severe weather near ${place}`;
    summary =
      'No active NWS alerts in this viewport. Pan or zoom if you are tracking a storm elsewhere — the helper only reads what is on screen / in range.';
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'nws',
    headline,
    summary,
    threats,
    actions,
    storms: storms.slice(0, 12),
    alertCount,
    severeCount,
    disclaimer:
      'Grounded in National Weather Service alerts. Not an official forecast. Seek shelter on tornado warnings regardless of this summary.',
  };
}

export async function fetchActiveAlerts(
  bbox?: string | null,
): Promise<NwsFeature[]> {
  const url = 'https://api.weather.gov/alerts/active';
  const res = await fetch(url, {
    headers: {
      'User-Agent': NWS_USER_AGENT,
      Accept: 'application/geo+json',
    },
  });
  if (!res.ok) throw new Error(`NWS alerts ${res.status}`);
  const data = (await res.json()) as { features?: NwsFeature[] };
  const features = data.features ?? [];
  if (!bbox) return features;

  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return features;
  }
  const [minLon, minLat, maxLon, maxLat] = parts as [
    number,
    number,
    number,
    number,
  ];

  return features.filter((f) => {
    if (!f.geometry) {
      return Boolean(f.properties?.areaDesc);
    }
    const flat =
      JSON.stringify(f.geometry)
        .match(/-?\d+\.?\d*/g)
        ?.map(Number) ?? [];
    for (let i = 0; i < flat.length; i += 2) {
      const lon = flat[i];
      const lat = flat[i + 1];
      if (
        lon != null &&
        lat != null &&
        lon >= minLon &&
        lon <= maxLon &&
        lat >= minLat &&
        lat <= maxLat
      ) {
        return true;
      }
    }
    return false;
  });
}

export async function polishBriefWithAi(
  brief: StormBrief,
): Promise<StormBrief> {
  const ollama =
    process.env.LOCAL_AI_URL?.trim() ||
    process.env.OLLAMA_URL?.trim() ||
    process.env.OLLAMA_HOST?.trim();
  const ollamaModel =
    process.env.LOCAL_AI_MODEL ?? process.env.OLLAMA_MODEL ?? 'llama3.2';

  const payload = JSON.stringify({
    headline: brief.headline,
    summary: brief.summary,
    threats: brief.threats,
    actions: brief.actions,
    storms: brief.storms.map((s) => ({
      type: s.type,
      danger: s.danger,
      area: s.area,
      motionLabel: s.motionLabel,
    })),
  });

  const instruction = [
    'You are a concise storm-chase briefing assistant for WeatherStop.',
    'Rewrite the JSON brief into a tighter 2–4 sentence summary and up to 4 threat bullets and 3 action bullets.',
    'Do NOT invent alerts, watches, or motion that are not in the input.',
    'Keep language calm and specific. Return JSON only with keys: headline, summary, threats, actions.',
    payload,
  ].join('\n');

  const applyParsed = (raw: string): StormBrief | null => {
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      const slice =
        start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
      const parsed = JSON.parse(slice) as {
        headline?: string;
        summary?: string;
        threats?: string[];
        actions?: string[];
      };
      return {
        ...brief,
        source: 'nws+ai',
        headline: parsed.headline?.trim() || brief.headline,
        summary: parsed.summary?.trim() || brief.summary,
        threats:
          Array.isArray(parsed.threats) && parsed.threats.length
            ? parsed.threats.map(String).slice(0, 6)
            : brief.threats,
        actions:
          Array.isArray(parsed.actions) && parsed.actions.length
            ? parsed.actions.map(String).slice(0, 5)
            : brief.actions,
      };
    } catch {
      return null;
    }
  };

  // Prefer local Ollama when configured (self-host / vercel dev).
  if (ollama) {
    try {
      const res = await fetch(`${ollama.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          stream: false,
          format: 'json',
          messages: [
            {
              role: 'system',
              content:
                'You only rephrase official NWS-derived storm briefs. Never add new hazards.',
            },
            { role: 'user', content: instruction },
          ],
          options: { temperature: 0.2 },
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as {
          message?: { content?: string };
        };
        const next = body.message?.content
          ? applyParsed(body.message.content)
          : null;
        if (next) return next;
      }
    } catch {
      // fall through to OpenAI if present
    }
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return brief;

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You only rephrase official NWS-derived storm briefs. Never add new hazards.',
          },
          { role: 'user', content: instruction },
        ],
      }),
    });
    if (!res.ok) return brief;
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) return brief;
    return applyParsed(raw) ?? brief;
  } catch {
    return brief;
  }
}
