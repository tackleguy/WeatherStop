// Web Mercator (EPSG:3857) helpers. NWS WMS expects bbox in meters,
// which MapLibre's `getBounds()` returns as lat/lon (EPSG:4326). These
// keep the conversion in one place.

const HALF_CIRCUMFERENCE_M = 20037508.34;

export function lngLatToMeters(lng: number, lat: number): [number, number] {
  const x = (lng * HALF_CIRCUMFERENCE_M) / 180;
  const yRad = Math.log(Math.tan(((90 + lat) * Math.PI) / 360));
  const y = (yRad * HALF_CIRCUMFERENCE_M) / Math.PI;
  return [x, y];
}

export function metersBboxFromLngLat(
  west: number,
  south: number,
  east: number,
  north: number,
): string {
  const [minX, minY] = lngLatToMeters(west, south);
  const [maxX, maxY] = lngLatToMeters(east, north);
  return `${minX},${minY},${maxX},${maxY}`;
}
