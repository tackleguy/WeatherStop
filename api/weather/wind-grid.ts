// Wind vector grid for the MIT particle overlay (u/v in mph).
//
//   /api/weather/wind-grid?bbox=w,s,e,n&cols=40&rows=24[&time=ISO-hour]

export const config = {
  runtime: 'nodejs',
  maxDuration: 20,
};

interface OpenMeteoHourly {
  time?: string[];
  wind_speed_10m?: (number | null)[];
  wind_direction_10m?: (number | null)[];
}
interface OpenMeteoResponse {
  current?: { wind_speed_10m?: number; wind_direction_10m?: number };
  hourly?: OpenMeteoHourly;
}

function hourKey(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return (
    `${d.getUTCFullYear()}-` +
    `${String(d.getUTCMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getUTCDate()).padStart(2, '0')}T` +
    `${String(d.getUTCHours()).padStart(2, '0')}:00`
  );
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url, 'https://x');
  const bboxRaw = searchParams.get('bbox');
  const hour = hourKey(searchParams.get('time'));
  const cols = Math.min(48, Math.max(8, Number(searchParams.get('cols') ?? 36) || 36));
  const rows = Math.min(36, Math.max(6, Number(searchParams.get('rows') ?? 22) || 22));

  if (!bboxRaw) return new Response('missing bbox', { status: 400 });
  const parts = bboxRaw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return new Response('bad bbox', { status: 400 });
  }
  let [west, south, east, north] = parts;
  if (east < west) [west, east] = [east, west];
  if (north < south) [south, north] = [north, south];
  if (east - west > 120 || north - south > 80) {
    return new Response('bbox too large', { status: 400 });
  }

  const points: Array<{ lat: number; lon: number }> = [];
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const lon = west + ((east - west) * (ix + 0.5)) / cols;
      const lat = north + ((south - north) * (iy + 0.5)) / rows;
      points.push({ lat, lon });
    }
  }

  const lats = points.map((p) => p.lat.toFixed(3)).join(',');
  const lons = points.map((p) => p.lon.toFixed(3)).join(',');
  const fields = 'wind_speed_10m,wind_direction_10m';
  const url = hour
    ? `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
      `&hourly=${fields}&start_hour=${encodeURIComponent(hour)}` +
      `&end_hour=${encodeURIComponent(hour)}&wind_speed_unit=mph&timezone=UTC`
    : `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
      `&current=${fields}&wind_speed_unit=mph`;

  let omResults: OpenMeteoResponse[];
  try {
    const res = await fetch(url);
    if (!res.ok) return new Response(`open-meteo ${res.status}`, { status: 502 });
    const json = (await res.json()) as OpenMeteoResponse | OpenMeteoResponse[];
    omResults = Array.isArray(json) ? json : [json];
  } catch {
    return new Response('open-meteo fetch failed', { status: 502 });
  }

  const u = new Float32Array(cols * rows);
  const v = new Float32Array(cols * rows);

  for (let i = 0; i < points.length; i++) {
    const r = omResults[i];
    let speed = Number.NaN;
    let dir = Number.NaN;
    if (hour && r?.hourly?.time?.length) {
      const idx = r.hourly.time.findIndex((t) => t.startsWith(hour));
      const j = idx >= 0 ? idx : 0;
      const s = r.hourly.wind_speed_10m?.[j];
      const d = r.hourly.wind_direction_10m?.[j];
      if (typeof s === 'number') speed = s;
      if (typeof d === 'number') dir = d;
    } else if (r?.current) {
      if (typeof r.current.wind_speed_10m === 'number') speed = r.current.wind_speed_10m;
      if (typeof r.current.wind_direction_10m === 'number') {
        dir = r.current.wind_direction_10m;
      }
    }
    if (!Number.isFinite(speed) || !Number.isFinite(dir)) {
      u[i] = 0;
      v[i] = 0;
      continue;
    }
    // Meteorological: direction wind blows FROM. Convert to vector TO.
    const rad = (dir * Math.PI) / 180;
    u[i] = -speed * Math.sin(rad);
    v[i] = -speed * Math.cos(rad);
  }

  const body = {
    bbox: [west, south, east, north] as [number, number, number, number],
    cols,
    rows,
    u: Array.from(u),
    v: Array.from(v),
    hour,
    license: 'App MIT; data Open-Meteo (CC BY 4.0)',
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=600',
    },
  });
}
