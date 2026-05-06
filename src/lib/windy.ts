// Windy URL helpers. Frontend never touches the upstream — we only
// generate the proxy URL pattern MapLibre will fan out to.

export function windyTileUrl(opts: {
  product: string; // 'radar' | 'satellite' | 'temp' | …
  ts: number; // epoch seconds, snapped to 10 minutes
  endpoint?: 'radar' | 'satellite';
}): string {
  const endpoint = opts.endpoint ?? 'radar';
  return `/api/${endpoint}/windy?z={z}&x={x}&y={y}&product=${opts.product}&ts=${opts.ts}`;
}
