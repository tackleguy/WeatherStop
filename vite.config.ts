import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Set DEV_API_PROXY to a deployed origin to exercise the real radar
// endpoints against local client code, e.g.
//   DEV_API_PROXY=https://weather-stop.vercel.app npm run dev
// Without it /api is stubbed (see devApiStub).
const API_PROXY = process.env.DEV_API_PROXY;

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// In `npm run dev`, most /api routes 503. Local-chat is special-cased so
// Storm Chase mode can talk to Ollama without `vercel dev`.
function devApiStub(): Plugin {
  const ollama =
    (process.env.LOCAL_AI_URL ?? process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434')
      .trim()
      .replace(/\/$/, '');
  const defaultModel =
    process.env.LOCAL_AI_MODEL ?? process.env.OLLAMA_MODEL ?? 'llama3.2';

  return {
    name: 'weatherstop-dev-api-stub',
    apply: 'serve',
    configureServer(server) {
      if (API_PROXY) return;
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        if (!req.url.startsWith('/api/')) return next();

        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/api/storm/dom3') {
          try {
            const feed = url.searchParams.get('feed')?.trim();
            const empty = {
              available: false,
              label: 'Dominator 3',
              error:
                'No live Dom 3 feed in vite dev. Paste a feed URL in Settings, or use vercel dev with DOM3_FEED_URL.',
              disclaimer:
                'Dom 3 position is only shown when a public/licensed feed is configured.',
            };
            if (!feed) {
              res.statusCode = 200;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify(empty));
              return;
            }
            const upstream = await fetch(feed, {
              headers: { Accept: 'application/json, application/geo+json' },
            });
            if (!upstream.ok) {
              res.statusCode = 200;
              res.setHeader('content-type', 'application/json');
              res.end(
                JSON.stringify({
                  ...empty,
                  error: `Feed HTTP ${upstream.status}`,
                }),
              );
              return;
            }
            const data = (await upstream.json()) as Record<string, unknown>;
            const lat = Number(data.lat ?? data.latitude);
            const lon = Number(data.lon ?? data.lng ?? data.longitude);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              res.statusCode = 200;
              res.setHeader('content-type', 'application/json');
              res.end(
                JSON.stringify({
                  available: true,
                  label: String(data.name ?? data.label ?? 'Dominator 3'),
                  lat,
                  lon,
                  heading: Number(data.heading ?? data.course) || undefined,
                  speedMph: Number(data.speedMph ?? data.speed) || undefined,
                  updatedAt: String(
                    data.updatedAt ?? data.time ?? new Date().toISOString(),
                  ),
                  source: 'feed',
                  disclaimer: empty.disclaimer,
                }),
              );
              return;
            }
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            res.end(
              JSON.stringify({
                ...empty,
                error: 'Feed JSON missing lat/lon',
              }),
            );
            return;
          } catch (err) {
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            res.end(
              JSON.stringify({
                available: false,
                label: 'Dominator 3',
                error:
                  err instanceof Error ? err.message : 'Dom 3 feed failed',
                disclaimer:
                  'Dom 3 position is only shown when a public/licensed feed is configured.',
              }),
            );
            return;
          }
        }

        if (url.pathname === '/api/storm/local-chat') {
          try {
            if (url.searchParams.get('probe') === '1') {
              const tags = await fetch(`${ollama}/api/tags`);
              res.statusCode = 200;
              res.setHeader('content-type', 'application/json');
              res.end(
                JSON.stringify(
                  tags.ok
                    ? { ok: true, model: defaultModel, base: ollama }
                    : { ok: false, error: `Ollama ${tags.status}` },
                ),
              );
              return;
            }
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('POST only');
              return;
            }
            const raw = await readBody(req);
            const body = JSON.parse(raw || '{}') as {
              prompt?: string;
              model?: string;
            };
            if (!body.prompt?.trim()) {
              res.statusCode = 400;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ error: 'missing prompt' }));
              return;
            }
            const upstream = await fetch(`${ollama}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: body.model?.trim() || defaultModel,
                stream: false,
                format: 'json',
                messages: [
                  {
                    role: 'system',
                    content:
                      'You are WeatherStop storm-chase assistant. Only use supplied NWS context. Never invent hazards. Return JSON as requested.',
                  },
                  { role: 'user', content: body.prompt },
                ],
                options: { temperature: 0.2 },
              }),
            });
            if (!upstream.ok) {
              res.statusCode = 502;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ error: `Ollama ${upstream.status}` }));
              return;
            }
            const data = (await upstream.json()) as {
              message?: { content?: string };
            };
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            res.end(
              JSON.stringify({
                content: data.message?.content ?? '',
                model: body.model?.trim() || defaultModel,
                via: 'ollama-dev',
              }),
            );
            return;
          } catch (err) {
            res.statusCode = 502;
            res.setHeader('content-type', 'application/json');
            res.end(
              JSON.stringify({
                error:
                  err instanceof Error
                    ? err.message
                    : 'Ollama unreachable in vite dev',
              }),
            );
            return;
          }
        }

        res.statusCode = 503;
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            error:
              'API routes are only served via `vercel dev` or in production.',
            path: req.url,
          }),
        );
      });
    },
  };
}

const apiProxyConfig = API_PROXY
  ? { '/api': { target: API_PROXY, changeOrigin: true, secure: true } }
  : undefined;

export default defineConfig({
  plugins: [react(), devApiStub()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: apiProxyConfig,
    watch: {
      // Keep the watcher out of api/ — those files are Vercel-runtime
      // source, not part of the SPA bundle.
      ignored: ['**/api/**', '**/.vercel/**', '**/dist/**'],
    },
  },
  build: {
    // Split big libs into their own chunks so a) the initial JS payload
    // is smaller for the home view and b) MapLibre / Framer cache
    // independently across deploys.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('maplibre-gl')) return 'maplibre';
            if (id.includes('framer-motion')) return 'motion';
            if (
              id.includes('react-router-dom') ||
              id.includes('@remix-run/router')
            )
              return 'router';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('zustand') || id.includes('swr')) {
              return 'state';
            }
            if (id.includes('react-dom')) return 'react-dom';
            if (id.includes('/react/')) return 'react';
          }
          return undefined;
        },
      },
    },
    // maplibre-gl is ~800 kB on its own and lives in a lazy-loaded
    // chunk only fetched when the user navigates to a map route. Raise
    // the warning above its size so we don't see noise on every build.
    chunkSizeWarningLimit: 900,
  },
});
