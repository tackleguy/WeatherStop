#!/usr/bin/env node
/**
 * Start the local AI backend, wait until it accepts connections, then run Vite.
 * Used by `npm run dev:ai`.
 */

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const AI_PORT = process.env.AI_SERVER_PORT || '8787';
const healthUrl = `http://127.0.0.1:${AI_PORT}/api/ai/health`;

const ai = spawn('npx', ['tsx', 'scripts/ai-server.ts'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

let vite = null;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (vite && !vite.killed) vite.kill('SIGTERM');
  if (ai && !ai.killed) ai.kill('SIGTERM');
  process.exit(code);
}

ai.on('exit', (code, signal) => {
  if (shuttingDown) return;
  console.error(
    `[dev:ai] AI server exited (code=${code} signal=${signal ?? ''})`,
  );
  shutdown(code ?? 1);
});

async function waitForAi(attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      await fetch(healthUrl);
      return true;
    } catch {
      // Upstream may be down (Ollama not started) but the proxy itself should
      // still answer — connection refused means the server isn't up yet.
    }
    // Also accept a listening TCP by probing the root index.
    try {
      const res = await fetch(`http://127.0.0.1:${AI_PORT}/api/ai`);
      if (res.ok || res.status >= 400) return true;
    } catch {
      /* retry */
    }
    await delay(150);
  }
  return false;
}

const ready = await waitForAi();
if (!ready) {
  console.error('[dev:ai] AI server did not become ready');
  shutdown(1);
}

vite = spawn('npx', ['vite'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

vite.on('exit', (code) => shutdown(code ?? 0));

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
