// Shared resilient fetch helper: retry with exponential backoff, optional
// mirror hedging, and per-request timeout. Drop-in replacement for bare fetch
// in upstream proxy routes that currently return 502 on first failure.

export interface ResilientOpts {
  /** Maximum number of attempts (default 3). */
  attempts?: number;
  /** Base delay between retries in ms (doubled each attempt, default 400). */
  backoffMs?: number;
  /** Per-attempt timeout in ms (default 8000). */
  timeoutMs?: number;
  /** Extra fetch init merged into every request. */
  init?: RequestInit;
  /** Treat these status codes as retryable (default 429, 500–599). */
  retryOn?: (status: number) => boolean;
}

const DEFAULT_RETRYABLE = (s: number) => s === 429 || s >= 500;

/**
 * Fetch a single URL with retries + timeout.
 * Resolves with the Response on success, throws on exhaustion.
 */
export async function resilientFetch(
  url: string,
  opts: ResilientOpts = {},
): Promise<Response> {
  const {
    attempts = 3,
    backoffMs = 400,
    timeoutMs = 8_000,
    init,
    retryOn = DEFAULT_RETRYABLE,
  } = opts;

  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, backoffMs * 2 ** (i - 1)));
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ac.signal });
      clearTimeout(timer);
      if (res.ok || !retryOn(res.status)) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetch failed');
}

/**
 * Race multiple mirror URLs, returning the first successful response.
 * Starts requests staggered by `hedgeMs` to avoid hammering all at once.
 */
export async function hedgedFetch(
  urls: string[],
  opts: Omit<ResilientOpts, 'attempts'> & { hedgeMs?: number } = {},
): Promise<Response> {
  const { hedgeMs = 1500, timeoutMs = 10_000, init } = opts;
  if (!urls.length) throw new Error('no URLs provided');
  if (urls.length === 1) return resilientFetch(urls[0], { ...opts, attempts: 2 });

  const ac = new AbortController();
  const deadline = setTimeout(() => ac.abort(), timeoutMs);

  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    let pending = urls.length;
    const errors: string[] = [];

    function tryUrl(url: string, delay: number) {
      setTimeout(async () => {
        if (settled || ac.signal.aborted) return;
        try {
          const res = await fetch(url, { ...init, signal: ac.signal });
          if (settled) return;
          if (res.ok) {
            settled = true;
            clearTimeout(deadline);
            resolve(res);
            return;
          }
          errors.push(`${new URL(url).host}: ${res.status}`);
        } catch (err) {
          if (settled) return;
          errors.push(
            `${new URL(url).host}: ${err instanceof Error ? err.message : 'failed'}`,
          );
        }
        pending--;
        if (pending <= 0 && !settled) {
          settled = true;
          clearTimeout(deadline);
          reject(new Error(errors.join('; ')));
        }
      }, delay);
    }

    urls.forEach((url, i) => tryUrl(url, i * hedgeMs));
  });
}
