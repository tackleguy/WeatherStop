/// <reference types="vite/client" />

// Best-effort service worker registration. Only runs in production
// builds; dev mode skips registration so HMR isn't fighting the cache.

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Periodic update check — once an hour, see if a new SW is
        // available. The next reload picks it up.
        setInterval(
          () => {
            registration.update().catch(() => undefined);
          },
          60 * 60_000,
        );
      })
      .catch(() => {
        // Registration failures are non-fatal.
      });
  });
}
