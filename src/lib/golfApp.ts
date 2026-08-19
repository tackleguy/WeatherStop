// WeatherStop Golf is a standalone product URL.
// Same deployment: /golf on the weather site, or the whole origin when
// the hostname is a golf subdomain / golf Vercel alias.

export function isGolfHost(hostname = window.location.hostname): boolean {
  const h = hostname.toLowerCase();
  if (h.startsWith('golf.')) return true;
  if (h.includes('weatherstop-golf')) return true;
  if (h.includes('golf-weatherstop')) return true;
  return false;
}

export function isGolfStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (isGolfHost()) return true;
  const path = window.location.pathname;
  return path === '/golf' || path.startsWith('/golf/');
}

export function weatherAppHref(): string {
  if (isGolfHost()) {
    const origin = import.meta.env.VITE_WEATHER_ORIGIN as string | undefined;
    return origin && origin.length ? origin : 'https://weather-stop.vercel.app';
  }
  return '/';
}
