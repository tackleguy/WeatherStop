import {
  errorResponse,
  getAiConfig,
  jsonResponse,
  probeUpstream,
} from '../_lib/aiProvider.js';

export const config = { runtime: 'edge' };

export default async function handler(_req: Request): Promise<Response> {
  const cfg = getAiConfig();
  const probe = await probeUpstream(cfg);

  if (!probe.ok) {
    return errorResponse(503, 'AI upstream unreachable', {
      provider: cfg.provider,
      baseUrl: cfg.baseUrl,
      status: probe.status,
      message: probe.rawError,
    });
  }

  return jsonResponse({
    ok: true,
    provider: cfg.provider,
    baseUrl: cfg.baseUrl,
    defaultModel: cfg.defaultModel,
    models: probe.models,
  });
}
