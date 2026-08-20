// Proxy to a local LLM (Ollama). Used when WeatherStop is run near Ollama
// (vercel dev, self-host). Browser can also call Ollama directly.

export const config = { runtime: 'edge' };

function ollamaBase(): string | null {
  const raw =
    process.env.LOCAL_AI_URL ??
    process.env.OLLAMA_URL ??
    process.env.OLLAMA_HOST ??
    '';
  const trimmed = raw.trim().replace(/\/$/, '');
  return trimmed || null;
}

function defaultModel(): string {
  return (
    process.env.LOCAL_AI_MODEL ??
    process.env.OLLAMA_MODEL ??
    'llama3.2'
  );
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const base = ollamaBase();

  if (searchParams.get('probe') === '1') {
    if (!base) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            'Set LOCAL_AI_URL=http://127.0.0.1:11434 (or OLLAMA_URL) on the server',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    try {
      const res = await fetch(`${base}/api/tags`);
      if (!res.ok) {
        return new Response(
          JSON.stringify({ ok: false, error: `Ollama ${res.status}` }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, model: defaultModel(), base }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    } catch (err) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Ollama unreachable',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  if (req.method !== 'POST') {
    return new Response('POST only', { status: 405 });
  }

  if (!base) {
    return new Response(
      JSON.stringify({
        error:
          'Local AI not configured. Set LOCAL_AI_URL to your Ollama host, or enable direct browser Ollama in Settings.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: { prompt?: string; model?: string };
  try {
    body = (await req.json()) as { prompt?: string; model?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return new Response(JSON.stringify({ error: 'missing prompt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const model = body.model?.trim() || defaultModel();

  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        messages: [
          {
            role: 'system',
            content:
              'You are WeatherStop storm-chase assistant. Only use supplied NWS context. Never invent hazards. Return JSON as requested.',
          },
          { role: 'user', content: prompt },
        ],
        options: { temperature: 0.2 },
      }),
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Ollama ${res.status}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const data = (await res.json()) as {
      message?: { content?: string };
    };
    const content = data.message?.content?.trim();
    if (!content) {
      return new Response(JSON.stringify({ error: 'empty model response' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ content, model, via: 'ollama' }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'local AI failed',
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
