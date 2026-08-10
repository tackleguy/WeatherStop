import {
  aiAuthHeaders,
  errorResponse,
  getAiConfig,
  jsonResponse,
  probeUpstream,
  resolveModel,
  type ChatRequestBody,
} from '../_lib/aiProvider.js';

export const config = { runtime: 'edge' };

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'POST only');
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return errorResponse(400, 'Invalid JSON body');
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return errorResponse(400, 'messages[] is required');
  }

  const cfg = getAiConfig();
  const probe = await probeUpstream(cfg);
  if (!probe.ok) {
    return errorResponse(503, 'AI upstream unreachable', {
      provider: cfg.provider,
      baseUrl: cfg.baseUrl,
      message: probe.rawError,
    });
  }

  const model = resolveModel(cfg, body.model, probe.models);
  if (!model) {
    return errorResponse(
      400,
      'No model available. Pull a model in Ollama or load one in LM Studio, or set AI_MODEL.',
      { models: probe.models },
    );
  }

  const payload = {
    ...body,
    model,
    stream: Boolean(body.stream),
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${cfg.v1Base}/chat/completions`, {
      method: 'POST',
      headers: {
        ...aiAuthHeaders(cfg),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return errorResponse(
      503,
      'AI upstream unreachable',
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return errorResponse(
      upstream.status >= 500 ? 502 : upstream.status,
      'AI chat completion failed',
      text.slice(0, 1000),
    );
  }

  // Stream SSE / NDJSON through as-is when requested.
  if (payload.stream && upstream.body) {
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type':
          upstream.headers.get('Content-Type') ?? 'text/event-stream',
        'Cache-Control': 'no-store',
        ...corsHeaders(),
      },
    });
  }

  const data = await upstream.json();
  return jsonResponse(data, { headers: corsHeaders() });
}
