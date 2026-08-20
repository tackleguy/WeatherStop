// Local LLM helpers — Ollama (or OpenAI-compatible local servers).
// Prefer same-origin /api/storm/local-chat (server-side Ollama), then
// browser → settings.localAiUrl for true on-machine chase mode.

import type { ChaseBrief } from './stormChaseBrief';

export interface LocalAiSettings {
  enabled: boolean;
  url: string;
  model: string;
}

export const DEFAULT_LOCAL_AI: LocalAiSettings = {
  enabled: true,
  url: 'http://127.0.0.1:11434',
  model: 'llama3.2',
};

const SYSTEM =
  'You are WeatherStop storm-chase assistant. You only rephrase or advise from the supplied NWS-derived JSON. Never invent warnings, watches, radar signatures, or storm motion. Keep answers short and chase-safe. If asked for positioning, remind the user that life safety beats the shot.';

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<
          string,
          unknown
        >;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function chatOllama(
  baseUrl: string,
  model: string,
  user: string,
  signal?: AbortSignal,
): Promise<string> {
  const root = baseUrl.replace(/\/$/, '');
  const res = await fetch(`${root}/api/chat`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
      options: { temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const body = (await res.json()) as {
    message?: { content?: string };
  };
  const content = body.message?.content?.trim();
  if (!content) throw new Error('Empty Ollama response');
  return content;
}

async function chatViaProxy(
  user: string,
  model: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch('/api/storm/local-chat', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: user }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(detail?.error ?? `local-chat ${res.status}`);
  }
  const body = (await res.json()) as { content?: string };
  if (!body.content) throw new Error('Empty local-chat response');
  return body.content;
}

/** Returns true if either the proxy or direct Ollama answers. */
export async function probeLocalAi(
  settings: LocalAiSettings,
  signal?: AbortSignal,
): Promise<{ ok: boolean; via: 'proxy' | 'direct' | null; detail: string }> {
  try {
    const res = await fetch('/api/storm/local-chat?probe=1', { signal });
    if (res.ok) {
      const body = (await res.json()) as { ok?: boolean; model?: string };
      if (body.ok) {
        return {
          ok: true,
          via: 'proxy',
          detail: body.model ? `Server Ollama · ${body.model}` : 'Server Ollama',
        };
      }
    }
  } catch {
    // fall through to direct
  }

  if (!settings.enabled) {
    return { ok: false, via: null, detail: 'Local AI disabled in settings' };
  }

  try {
    const root = settings.url.replace(/\/$/, '');
    const res = await fetch(`${root}/api/tags`, { signal });
    if (!res.ok) {
      return { ok: false, via: null, detail: `Ollama HTTP ${res.status}` };
    }
    return {
      ok: true,
      via: 'direct',
      detail: `Direct · ${settings.model} @ ${root}`,
    };
  } catch {
    return {
      ok: false,
      via: null,
      detail:
        'Ollama not reachable. Start `ollama serve` and allow CORS (OLLAMA_ORIGINS), or set LOCAL_AI_URL on the API.',
    };
  }
}

export async function polishBriefWithLocalAi(
  brief: ChaseBrief,
  settings: LocalAiSettings,
  signal?: AbortSignal,
): Promise<ChaseBrief> {
  const user = [
    'Rewrite this chase brief. Return JSON only with keys: headline, summary, threats, actions.',
    'threats: up to 4 short strings. actions: up to 3 short strings.',
    JSON.stringify({
      headline: brief.headline,
      summary: brief.summary,
      threats: brief.threats,
      actions: brief.actions,
      nearest: brief.nearest,
      storms: brief.storms.map((s) => ({
        type: s.type,
        danger: s.danger,
        area: s.area,
        motionLabel: s.motionLabel,
      })),
    }),
  ].join('\n');

  let raw: string;
  try {
    raw = await chatViaProxy(user, settings.model, signal);
  } catch {
    if (!settings.enabled) return brief;
    raw = await chatOllama(settings.url, settings.model, user, signal);
  }

  const parsed = extractJsonObject(raw);
  if (!parsed) return brief;

  return {
    ...brief,
    source: 'local+ollama',
    headline: String(parsed.headline ?? brief.headline).trim() || brief.headline,
    summary: String(parsed.summary ?? brief.summary).trim() || brief.summary,
    threats: Array.isArray(parsed.threats)
      ? parsed.threats.map(String).slice(0, 6)
      : brief.threats,
    actions: Array.isArray(parsed.actions)
      ? parsed.actions.map(String).slice(0, 5)
      : brief.actions,
  };
}

export async function askLocalChaseAi(
  question: string,
  brief: ChaseBrief,
  settings: LocalAiSettings,
  signal?: AbortSignal,
): Promise<string> {
  const user = [
    'Answer the chase question in 2–5 short sentences.',
    'Return JSON only: { "answer": "..." }',
    `Question: ${question}`,
    `Context: ${JSON.stringify({
      headline: brief.headline,
      summary: brief.summary,
      nearest: brief.nearest,
      threats: brief.threats,
      storms: brief.storms.slice(0, 6),
    })}`,
  ].join('\n');

  let raw: string;
  try {
    raw = await chatViaProxy(user, settings.model, signal);
  } catch {
    if (!settings.enabled) {
      throw new Error('Local AI is disabled in Settings');
    }
    raw = await chatOllama(settings.url, settings.model, user, signal);
  }

  const parsed = extractJsonObject(raw);
  if (parsed?.answer) return String(parsed.answer).trim();
  return raw.trim();
}
