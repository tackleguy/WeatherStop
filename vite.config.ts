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

        if (url.pathname === '/api/storm/chasers') {
          const DISCLAIMER =
            'Chaser positions only appear from public/licensed feeds you configure. Not affiliated with any chase team.';
          const CATALOG = [
            {
              id: 'reed-timmer',
              name: 'Reed Timmer',
              team: 'Team Dominator',
              vehicle: 'Dominator 3',
              color: '#f59e0b',
              notes: 'Dom 3 intercept science / livestreams',
            },
            {
              id: 'skip-talbot',
              name: 'Skip Talbot',
              team: 'Skip Talbot',
              color: '#38bdf8',
              notes: 'Classic structure photography chases',
            },
            {
              id: 'pecos-hank',
              name: 'Pecos Hank',
              team: 'Pecos Hank',
              color: '#a78bfa',
              notes: 'IMAX / viral tornado footage',
            },
            {
              id: 'brandon-clement',
              name: 'Brandon Clement',
              team: 'Brandon Clement',
              color: '#34d399',
              notes: 'Storm video / drone work',
            },
            {
              id: 'mike-olbinado',
              name: 'Mike Olbinado',
              team: 'Basehunters',
              color: '#fb7185',
              notes: 'Basehunters chase team',
            },
            {
              id: 'jordan-fish',
              name: 'Jordan Fish',
              team: 'Convective Addiction',
              color: '#f472b6',
              notes: 'Convective Addiction media',
            },
            {
              id: 'ryan-shepard',
              name: 'Ryan Shepard',
              team: 'Ryan Shepard',
              color: '#2dd4bf',
              notes: 'Plains chasing / photography',
            },
            {
              id: 'james-spinardi',
              name: 'James Spinardi',
              team: 'James Spinardi',
              color: '#e879f9',
              notes: 'Storm media / intercepts',
            },
          ] as const;

          let overrides: Record<string, string> = {};
          try {
            const raw = url.searchParams.get('feeds');
            if (raw?.trim()) {
              overrides = JSON.parse(raw) as Record<string, string>;
            }
          } catch {
            overrides = {};
          }
          const dom3Feed = url.searchParams.get('dom3Feed')?.trim();
          if (dom3Feed) overrides = { ...overrides, 'reed-timmer': dom3Feed };

          async function resolveFeed(feed: string, label: string) {
            try {
              const upstream = await fetch(feed, {
                headers: { Accept: 'application/json, application/geo+json' },
              });
              if (!upstream.ok) return null;
              const data = (await upstream.json()) as Record<string, unknown>;
              const lat = Number(data.lat ?? data.latitude);
              const lon = Number(data.lon ?? data.lng ?? data.longitude);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
              return {
                available: true as const,
                lat,
                lon,
                label: String(data.name ?? data.label ?? label),
                heading: Number(data.heading ?? data.course) || undefined,
                speedMph: Number(data.speedMph ?? data.speed) || undefined,
                updatedAt: String(
                  data.updatedAt ?? data.time ?? new Date().toISOString(),
                ),
                source: 'feed',
              };
            } catch {
              return null;
            }
          }

          const chasers = await Promise.all(
            CATALOG.map(async (c) => {
              const feed = overrides[c.id];
              if (feed) {
                const fix = await resolveFeed(feed, c.name);
                if (fix) {
                  return {
                    id: c.id,
                    available: true,
                    label: fix.label,
                    team: c.team,
                    vehicle: 'vehicle' in c ? c.vehicle : undefined,
                    lat: fix.lat,
                    lon: fix.lon,
                    heading: fix.heading,
                    speedMph: fix.speedMph,
                    updatedAt: fix.updatedAt,
                    source: fix.source,
                    color: c.color,
                    notes: c.notes,
                  };
                }
                return {
                  id: c.id,
                  available: false,
                  label: c.name,
                  team: c.team,
                  vehicle: 'vehicle' in c ? c.vehicle : undefined,
                  color: c.color,
                  notes: c.notes,
                  error: 'Feed returned no lat/lon',
                };
              }
              return {
                id: c.id,
                available: false,
                label: c.name,
                team: c.team,
                vehicle: 'vehicle' in c ? c.vehicle : undefined,
                color: c.color,
                notes: c.notes,
                error:
                  'No feed in vite dev — paste Feeds JSON / Dom 3 URL in Settings',
              };
            }),
          );
          const liveCount = chasers.filter((c) => c.available).length;
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          res.end(
            JSON.stringify({
              generatedAt: new Date().toISOString(),
              liveCount,
              chasers,
              disclaimer: DISCLAIMER,
            }),
          );
          return;
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
