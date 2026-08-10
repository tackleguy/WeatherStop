#!/usr/bin/env npx tsx
/**
 * Local AI backend for WeatherStop.
 * Proxies OpenAI-compatible chat/models/health to Ollama or LM Studio and
 * serves storm-analysis using the same handlers as Vercel edge routes.
 *
 *   AI_PROVIDER=ollama|lmstudio|openai-compatible
 *   AI_BASE_URL=http://127.0.0.1:11434
 *   AI_MODEL=llama3.1:8b
 *   AI_SERVER_PORT=8787
 */

import http from 'node:http';
import { URL } from 'node:url';
import chatHandler from '../api/ai/chat.ts';
import healthHandler from '../api/ai/health.ts';
import modelsHandler from '../api/ai/models.ts';
import stormHandler from '../api/ai/storm-analysis.ts';
import { getAiConfig, jsonResponse } from '../api/_lib/aiProvider.ts';

const PORT = Number(process.env.AI_SERVER_PORT || 8787);
const cfg = getAiConfig();

type EdgeHandler = (req: Request) => Promise<Response>;

const routes: Record<string, EdgeHandler> = {
  '/api/ai/health': healthHandler,
  '/health': healthHandler,
  '/api/ai/models': modelsHandler,
  '/models': modelsHandler,
  '/api/ai/chat': chatHandler,
  '/chat': chatHandler,
  '/api/ai/storm-analysis': stormHandler,
  '/storm-analysis': stormHandler,
};

async function readRawBody(req: http.IncomingMessage): Promise<ArrayBuffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const buf = Buffer.concat(chunks);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function toFetchRequest(
  req: http.IncomingMessage,
  url: URL,
): Promise<Request> {
  const method = req.method || 'GET';
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const item of v) headers.append(k, item);
    else headers.set(k, v);
  }

  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, { method, headers });
  }
  const body = await readRawBody(req);
  return new Request(url, { method, headers, body });
}

async function writeFetchResponse(
  res: http.ServerResponse,
  response: Response,
): Promise<void> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);

  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } finally {
    res.end();
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  try {
    if (path === '/' || path === '/api/ai') {
      const body = jsonResponse({
        service: 'weatherstop-ai',
        provider: cfg.provider,
        baseUrl: cfg.baseUrl,
        defaultModel: cfg.defaultModel,
        endpoints: [
          '/api/ai/health',
          '/api/ai/models',
          '/api/ai/chat',
          '/api/ai/storm-analysis',
        ],
      });
      await writeFetchResponse(res, body);
      return;
    }

    const handler = routes[path];
    if (!handler) {
      await writeFetchResponse(
        res,
        jsonResponse({ error: `Unknown path: ${path}` }, { status: 404 }),
      );
      return;
    }

    const request = await toFetchRequest(req, url);
    const response = await handler(request);
    await writeFetchResponse(res, response);
  } catch (err) {
    console.error('[ai-server]', err);
    await writeFetchResponse(
      res,
      jsonResponse(
        {
          error: 'Internal AI server error',
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      ),
    );
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[ai-server] listening on http://127.0.0.1:${PORT} → ${cfg.provider} ${cfg.baseUrl}`,
  );
  console.log(
    '[ai-server] endpoints: /api/ai/health  /api/ai/models  /api/ai/chat  /api/ai/storm-analysis',
  );
});
