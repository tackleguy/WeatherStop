import {
  aiAuthHeaders,
  errorResponse,
  getAiConfig,
  jsonResponse,
  probeUpstream,
  resolveModel,
} from '../_lib/aiProvider.js';
import {
  applyAiEnrichment,
  buildStormFeaturesFromAlerts,
  emptyStormAnalysis,
  extractJsonObject,
  summarizeFeatures,
  type SlimAlert,
  type StormAnalysisResult,
} from '../_lib/stormAnalysis.js';

export const config = { runtime: 'edge' };

interface RequestBody {
  bbox?: [number, number, number, number];
  alerts?: SlimAlert[];
  model?: string;
  /** Skip LLM enrichment (deterministic NWS-only overlays). */
  heuristicOnly?: boolean;
}

function isFiniteBbox(
  b: unknown,
): b is [number, number, number, number] {
  return (
    Array.isArray(b) &&
    b.length === 4 &&
    b.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

function alertInBbox(alert: SlimAlert, bbox: [number, number, number, number]): boolean {
  if (!alert.geometry) return false;
  // Cheap: stringify coords and check any lon/lat pair falls inside.
  const nums = JSON.stringify(alert.geometry).match(/-?\d+(?:\.\d+)?/g);
  if (!nums) return false;
  const vals = nums.map(Number);
  for (let i = 0; i + 1 < vals.length; i += 2) {
    const lon = vals[i];
    const lat = vals[i + 1];
    if (
      lon >= bbox[0] &&
      lon <= bbox[2] &&
      lat >= bbox[1] &&
      lat <= bbox[3]
    ) {
      return true;
    }
  }
  return false;
}

function buildAiPrompt(
  bbox: [number, number, number, number],
  alerts: SlimAlert[],
): string {
  const slim = alerts.slice(0, 12).map((a) => ({
    id: a.id,
    event: a.event,
    severity: a.severity,
    area: a.areaDesc.slice(0, 120),
    headline: a.headline.slice(0, 180),
    description: a.description.slice(0, 500),
  }));

  return `You are a severe-weather analyst assisting a radar map.

Viewport bbox [west,south,east,north]: ${JSON.stringify(bbox)}

Active NWS alerts in view (JSON):
${JSON.stringify(slim, null, 2)}

Return ONLY valid JSON (no markdown) with this shape:
{
  "note": "one short situational sentence",
  "storms": [
    {
      "stormId": "<exact alert id>",
      "label": "short storm identity label",
      "detail": "what the storm is doing now",
      "tornadoRisk": "formation / indicated / none — one short phrase",
      "confidence": 0.0
    }
  ]
}

Rules:
- Only include storms that are severe thunderstorm or tornado related.
- stormId MUST match an alert id from the list.
- confidence is 0..1.
- Be concise. Do not invent coordinates.`;
}

async function enrichWithAi(
  bbox: [number, number, number, number],
  alerts: SlimAlert[],
  modelHint?: string,
): Promise<{ enrichment: unknown | null; error: string | null }> {
  const cfg = getAiConfig();
  const probe = await probeUpstream(cfg);
  if (!probe.ok) {
    return { enrichment: null, error: probe.rawError ?? 'AI upstream unreachable' };
  }
  const model = resolveModel(cfg, modelHint, probe.models);
  if (!model) {
    return { enrichment: null, error: 'No AI model available' };
  }

  try {
    const upstream = await fetch(`${cfg.v1Base}/chat/completions`, {
      method: 'POST',
      headers: {
        ...aiAuthHeaders(cfg),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content:
              'You identify storms, tornado formation risk, and short track notes from NWS alert text. Reply with JSON only.',
          },
          { role: 'user', content: buildAiPrompt(bbox, alerts) },
        ],
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return { enrichment: null, error: text.slice(0, 400) || `HTTP ${upstream.status}` };
    }

    const data = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    const parsed = extractJsonObject(content);
    return { enrichment: parsed, error: parsed ? null : 'AI returned non-JSON' };
  } catch (err) {
    return {
      enrichment: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'POST only');
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return errorResponse(400, 'Invalid JSON body');
  }

  if (!isFiniteBbox(body.bbox)) {
    return errorResponse(400, 'bbox [west,south,east,north] is required');
  }

  const alerts = (Array.isArray(body.alerts) ? body.alerts : []).filter(
    (a): a is SlimAlert =>
      Boolean(a) &&
      typeof a.id === 'string' &&
      typeof a.event === 'string',
  );

  const inView = alerts.filter((a) => alertInBbox(a, body.bbox!));
  const candidates = inView.length > 0 ? inView : alerts;

  let features = buildStormFeaturesFromAlerts(candidates);
  if (features.length === 0) {
    const empty = emptyStormAnalysis(
      'No severe thunderstorm or tornado alerts with geometry in this view. Pan to an active warning or wait for NWS updates.',
    );
    return jsonResponse(empty);
  }

  let source: StormAnalysisResult['summary']['source'] = 'nws';
  let note =
    'Storm boxes and paths derived from NWS warning polygons and storm motion.';

  if (!body.heuristicOnly) {
    const { enrichment, error } = await enrichWithAi(
      body.bbox,
      candidates,
      body.model,
    );
    if (enrichment) {
      const merged = applyAiEnrichment(features, enrichment);
      features = merged.features;
      source = 'nws+ai';
      note =
        merged.note ??
        'AI-enriched storm IDs, tornado formation notes, and confidence on NWS geometries.';
    } else if (error) {
      note = `NWS geometries only (AI enrichment skipped: ${error}).`;
    }
  }

  const result: StormAnalysisResult = {
    type: 'FeatureCollection',
    features,
    summary: summarizeFeatures(features, source, note),
  };

  return jsonResponse(result, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}
