// Web Mercator helpers for serverless radar APIs.

const HALF = 20037508.34;

export function lngLatToMeters(lng: number, lat: number): [number, number] {
  const x = (lng * HALF) / 180;
  const yRad = Math.log(Math.tan(((90 + lat) * Math.PI) / 360));
  const y = (yRad * HALF) / Math.PI;
  return [x, y];
}

export function metersToLngLat(x: number, y: number): [number, number] {
  const lng = (x / HALF) * 180;
  const lat =
    (Math.atan(Math.exp((y / HALF) * Math.PI)) * 360) / Math.PI - 90;
  return [lng, lat];
}

export function parseBbox3857(
  bbox: string,
): [number, number, number, number] | null {
  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return [parts[0], parts[1], parts[2], parts[3]];
}
