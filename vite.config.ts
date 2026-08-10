import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Set DEV_API_PROXY to a deployed origin to exercise the real radar
// endpoints against local client code, e.g.
//   DEV_API_PROXY=https://weather-stop.vercel.app npm run dev
// Without it /api is stubbed (see devApiStub), except /api/ai which
// proxies to the local AI server (Ollama / LM Studio via npm run ai:server).
const API_PROXY = process.env.DEV_API_PROXY;
const AI_SERVER_PORT = process.env.AI_SERVER_PORT || '8787';
const AI_SERVER_ORIGIN =
  process.env.AI_SERVER_ORIGIN || `http://127.0.0.1:${AI_SERVER_PORT}`;

// `npm run dev` doesn't execute the Vercel Edge Functions in /api — those
// only run under `vercel dev` or in production. Without this plugin the
// browser's calls to /api/alerts etc. would land on the Vite dev server,
// which then tries to transform the .ts source through its esbuild
// plugin and fails noisily on the query string. Returning a 503 makes
// SWR back off cleanly and matches what the user sees in production
// when WINDY_KEY isn't configured.
//
// /api/ai/* is excluded: it is proxied to scripts/ai-server.mjs so local
// Ollama / LM Studio work during `npm run dev`.
function devApiStub(): Plugin {
  return {
    name: 'weatherstop-dev-api-stub',
    apply: 'serve',
    configureServer(server) {
      if (API_PROXY) return;
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        if (!req.url.startsWith('/api/')) return next();
        if (req.url.startsWith('/api/ai')) return next();
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
  : {
      '/api/ai': {
        target: AI_SERVER_ORIGIN,
        changeOrigin: true,
      },
    };

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
