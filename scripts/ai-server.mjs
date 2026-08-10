#!/usr/bin/env node
/**
 * Local AI backend for WeatherStop.
 *
 * Proxies OpenAI-compatible chat/models/health to Ollama or LM Studio so
 * `npm run dev` can hit /api/ai/* without `vercel dev`.
 *
 *   AI_PROVIDER=ollama|lmstudio|openai-compatible
 *   AI_BASE_URL=http://127.0.0.1:11434   # or :1234 for LM Studio
 *   AI_MODEL=llama3.1:8b
 *   AI_API_KEY=optional
 *   AI_SERVER_PORT=8787
 *
 * Start Ollama (`ollama serve`) or enable LM Studio's local server first.
 */

import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.AI_SERVER_PORT || 8787);
const PROVIDER_ENV = (process.env.AI_PROVIDER || '').trim().toLowerCase();
const RAW_BASE = (process.env.AI_BASE_URL || '').trim();
const DEFAULT_MODEL = (process.env.AI_MODEL || '').trim() || null;
const API_KEY = (process.env.AI_API_KEY || '').trim() || null;

function detectProvider(baseUrl) {
  if (
    PROVIDER_ENV === 'ollama' ||
    PROVIDER_ENV === 'lmstudio' ||
    PROVIDER_ENV === 'openai-compatible'
  ) {
    return PROVIDER_ENV;
  }
  if (!baseUrl) return 'ollama';
  if (baseUrl.includes(':1234')) return 'lmstudio';
  if (baseUrl.includes(':11434')) return 'ollama';
  return 'openai-compatible';
}

function stripSlash(url) {
  return url.replace(/\/+$/, '');
}

const provider = detectProvider(RAW_BASE);
const baseUrl = stripSlash(
  RAW_BASE ||
    (provider === 'lmstudio'
      ? 'http://127.0.0.1:1234'
      : 'http://127.0.0.1:11434'),
);
const v1Base = `${baseUrl}/v1`;

function authHeaders() {
  const headers = { Accept: 'application/json' };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  else if (provider === 'ollama') headers.Authorization = 'Bearer ollama';
  return headers;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(payload);
}

function fail(res, status, error, detail) {
  sendJson(res, status, {
    error,
    detail: detail ?? undefined,
    hint:
      status === 502 || status === 503
        ? 'Start Ollama (`ollama serve`) or LM Studio local server, then set AI_PROVIDER / AI_BASE_URL if needed.'
        : undefined,
  });
}

async function probeModels() {
  try {
    const upstream = await fetch(`${v1Base}/models`, { headers: authHeaders() });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return {
        ok: false,
        status: upstream.status,
        models: [],
        rawError: text.slice(0, 500),
      };
    }
    const data = await upstream.json();
    const models = (data.data || [])
      .map((m) => m.id)
      .filter(Boolean);
    return { ok: true, status: upstream.status, models, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      models: [],
      rawError: err instanceof Error ? err.message : String(err),
    };
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function handleHealth(_req, res) {
  const probe = await probeModels();
  if (!probe.ok) {
    return fail(res, 503, 'AI upstream unreachable', {
      provider,
      baseUrl,
      status: probe.status,
      message: probe.rawError,
    });
  }
  return sendJson(res, 200, {
    ok: true,
    provider,
    baseUrl,
    defaultModel: DEFAULT_MODEL,
    models: probe.models,
  });
}

async function handleModels(_req, res) {
  const probe = await probeModels();
  if (!probe.ok) {
    return fail(res, 503, 'AI upstream unreachable', {
      provider,
      baseUrl,
      message: probe.rawError,
    });
  }
  return sendJson(res, 200, {
    provider,
    baseUrl,
    defaultModel: DEFAULT_MODEL,
    ...(probe.data || { data: [] }),
  });
}

async function handleChat(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }
  if (req.method !== 'POST') return fail(res, 405, 'POST only');

  let body;
  try {
    body = await readBody(req);
  } catch {
    return fail(res, 400, 'Invalid JSON body');
  }

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return fail(res, 400, 'messages[] is required');
  }

  const probe = await probeModels();
  if (!probe.ok) {
    return fail(res, 503, 'AI upstream unreachable', {
      provider,
      baseUrl,
      message: probe.rawError,
    });
  }

  const model =
    (typeof body.model === 'string' && body.model.trim()) ||
    DEFAULT_MODEL ||
    probe.models[0] ||
    null;

  if (!model) {
    return fail(
      res,
      400,
      'No model available. Pull a model in Ollama or load one in LM Studio, or set AI_MODEL.',
      { models: probe.models },
    );
  }

  const payload = { ...body, model, stream: Boolean(body.stream) };

  let upstream;
  try {
    upstream = await fetch(`${v1Base}/chat/completions`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return fail(
      res,
      503,
      'AI upstream unreachable',
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return fail(
      res,
      upstream.status >= 500 ? 502 : upstream.status,
      'AI chat completion failed',
      text.slice(0, 1000),
    );
  }

  if (payload.stream && upstream.body) {
    res.writeHead(200, {
      'Content-Type':
        upstream.headers.get('Content-Type') || 'text/event-stream',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    });
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } finally {
      res.end();
    }
    return;
  }

  const data = await upstream.json();
  return sendJson(res, 200, data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (path === '/api/ai/health' || path === '/health') {
      return await handleHealth(req, res);
    }
    if (path === '/api/ai/models' || path === '/models') {
      return await handleModels(req, res);
    }
    if (path === '/api/ai/chat' || path === '/chat') {
      return await handleChat(req, res);
    }
    if (path === '/' || path === '/api/ai') {
      return sendJson(res, 200, {
        service: 'weatherstop-ai',
        provider,
        baseUrl,
        endpoints: ['/api/ai/health', '/api/ai/models', '/api/ai/chat'],
      });
    }
    return fail(res, 404, `Unknown path: ${path}`);
  } catch (err) {
    console.error('[ai-server]', err);
    return fail(
      res,
      500,
      'Internal AI server error',
      err instanceof Error ? err.message : String(err),
    );
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[ai-server] listening on http://127.0.0.1:${PORT} → ${provider} ${baseUrl}`,
  );
  console.log(
    `[ai-server] endpoints: /api/ai/health  /api/ai/models  /api/ai/chat`,
  );
});
