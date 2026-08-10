// Thin client for the WeatherStop AI backend (/api/ai/*).
// Talks to the local Node AI server in dev, or Vercel edge routes in prod.
// Upstream is Ollama or LM Studio via OpenAI-compatible /v1 endpoints.

export interface AiHealth {
  ok: boolean;
  provider: string;
  baseUrl: string;
  defaultModel: string | null;
  models: string[];
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatOptions {
  model?: string;
  messages: AiChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  signal?: AbortSignal;
}

export interface AiChatChoice {
  index?: number;
  message?: { role?: string; content?: string };
  finish_reason?: string | null;
}

export interface AiChatCompletion {
  id?: string;
  model?: string;
  choices?: AiChatChoice[];
  usage?: Record<string, number>;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; detail?: unknown };
    if (data.error) {
      return typeof data.detail === 'string'
        ? `${data.error}: ${data.detail}`
        : data.error;
    }
  } catch {
    /* ignore */
  }
  return `AI request failed (${res.status})`;
}

export async function fetchAiHealth(signal?: AbortSignal): Promise<AiHealth> {
  const res = await fetch('/api/ai/health', { signal });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as AiHealth;
}

export async function fetchAiModels(signal?: AbortSignal): Promise<{
  provider: string;
  defaultModel: string | null;
  data: Array<{ id: string }>;
}> {
  const res = await fetch('/api/ai/models', { signal });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as {
    provider: string;
    defaultModel: string | null;
    data: Array<{ id: string }>;
  };
}

export async function chatCompletion(
  opts: AiChatOptions,
): Promise<AiChatCompletion> {
  const { signal, ...body } = opts;
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: false }),
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as AiChatCompletion;
}

/** Convenience: return assistant text from a non-streaming completion. */
export async function chatText(opts: AiChatOptions): Promise<string> {
  const completion = await chatCompletion(opts);
  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty AI response');
  return text;
}
