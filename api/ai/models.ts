import {
  aiAuthHeaders,
  errorResponse,
  getAiConfig,
  jsonResponse,
} from '../_lib/aiProvider.js';

export const config = { runtime: 'edge' };

export default async function handler(_req: Request): Promise<Response> {
  const cfg = getAiConfig();

  try {
    const upstream = await fetch(`${cfg.v1Base}/models`, {
      headers: aiAuthHeaders(cfg),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return errorResponse(
        upstream.status === 404 ? 502 : upstream.status,
        'Failed to list models from AI upstream',
        text.slice(0, 500),
      );
    }

    const data = await upstream.json();
    return jsonResponse({
      provider: cfg.provider,
      baseUrl: cfg.baseUrl,
      defaultModel: cfg.defaultModel,
      ...((data && typeof data === 'object') ? data : { data: [] }),
    });
  } catch (err) {
    return errorResponse(
      503,
      'AI upstream unreachable',
      err instanceof Error ? err.message : String(err),
    );
  }
}
