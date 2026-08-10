// Shared LM Studio / Ollama (OpenAI-compatible) provider config for /api/ai/*.
//
// Env:
//   AI_PROVIDER   = "ollama" | "lmstudio" | "openai-compatible"  (default: auto)
//   AI_BASE_URL   = override upstream origin (e.g. http://127.0.0.1:11434)
//   AI_MODEL      = default model id when the client omits `model`
//   AI_API_KEY    = optional Bearer token (LM Studio may require one; Ollama ignores)

export type AiProvider = 'ollama' | 'lmstudio' | 'openai-compatible';

export interface AiConfig {
  provider: AiProvider;
  /** Origin only, no trailing slash — e.g. http://127.0.0.1:11434 */
  baseUrl: string;
  /** OpenAI-compatible root — `${baseUrl}/v1` */
  v1Base: string;
  defaultModel: string | null;
  apiKey: string | null;
}

const DEFAULTS: Record<'ollama' | 'lmstudio', string> = {
  ollama: 'http://127.0.0.1:11434',
  lmstudio: 'http://127.0.0.1:1234',
};

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function detectProvider(baseUrl: string | undefined): AiProvider {
  const explicit = (process.env.AI_PROVIDER ?? '').trim().toLowerCase();
  if (explicit === 'ollama' || explicit === 'lmstudio' || explicit === 'openai-compatible') {
    return explicit;
  }
  if (!baseUrl) return 'ollama';
  if (baseUrl.includes(':1234')) return 'lmstudio';
  if (baseUrl.includes(':11434')) return 'ollama';
  return 'openai-compatible';
}

export function getAiConfig(): AiConfig {
  const rawBase = process.env.AI_BASE_URL?.trim();
  const provider = detectProvider(rawBase);
  const baseUrl = stripTrailingSlash(
    rawBase ||
      (provider === 'lmstudio' ? DEFAULTS.lmstudio : DEFAULTS.ollama),
  );
  const defaultModel = process.env.AI_MODEL?.trim() || null;
  const apiKey = process.env.AI_API_KEY?.trim() || null;

  return {
    provider,
    baseUrl,
    v1Base: `${baseUrl}/v1`,
    defaultModel,
    apiKey,
  };
}

export function aiAuthHeaders(cfg: AiConfig): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (cfg.apiKey) {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  } else if (cfg.provider === 'ollama') {
    // OpenAI SDK clients often send a dummy key; Ollama accepts any value.
    headers.Authorization = 'Bearer ollama';
  }
  return headers;
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit & { status?: number } = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers ?? {}),
    },
  });
}

export function errorResponse(
  status: number,
  error: string,
  detail?: unknown,
): Response {
  return jsonResponse(
    {
      error,
      detail: detail ?? undefined,
      hint:
        status === 502 || status === 503
          ? 'Start Ollama (`ollama serve`) or LM Studio local server, then set AI_PROVIDER / AI_BASE_URL if needed.'
          : undefined,
    },
    { status },
  );
}

/** Probe the upstream so health can report ready vs unreachable. */
export async function probeUpstream(cfg: AiConfig): Promise<{
  ok: boolean;
  status: number;
  models: string[];
  rawError?: string;
}> {
  try {
    const res = await fetch(`${cfg.v1Base}/models`, {
      headers: aiAuthHeaders(cfg),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        status: res.status,
        models: [],
        rawError: text.slice(0, 500),
      };
    }
    const data = (await res.json()) as {
      data?: Array<{ id?: string }>;
    };
    const models = (data.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id));
    return { ok: true, status: res.status, models };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      models: [],
      rawError: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export interface ChatRequestBody {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  [key: string]: unknown;
}

export function resolveModel(
  cfg: AiConfig,
  requested: string | undefined,
  available: string[],
): string | null {
  if (requested?.trim()) return requested.trim();
  if (cfg.defaultModel) return cfg.defaultModel;
  return available[0] ?? null;
}
