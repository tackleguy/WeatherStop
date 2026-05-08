// RainViewer raster tile proxy. RainViewer publishes a per-frame
// manifest at /public/weather-maps.json that we cache for 60 seconds —
// every tile request would otherwise re-pull the same JSON.
//
//   /api/radar/rainviewer?z=6&x=10&y=22&kind=radar
//   /api/radar/rainviewer?z=6&x=10&y=22&kind=satellite&ts=1715040000
//
// The trailing `0_1.png` suffix tells RainViewer to serve smoothing=0,
// snow=1 — sharp pixels (the "RadarScope" look) instead of the
// default soft interpolation.

export const config = { runtime: 'edge' };

interface RainViewerFrame {
  time: number;
  path: string;
}
interface RainViewerManifest {
  host: string;
  radar: { past: RainViewerFrame[]; nowcast: RainViewerFrame[] };
  satellite: { infrared: RainViewerFrame[] };
}

let manifestCache: { data: RainViewerManifest; expires: number } | null = null;

async function getManifest(): Promise<RainViewerManifest> {
  if (manifestCache && manifestCache.expires > Date.now()) {
    return manifestCache.data;
  }
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  const data = (await res.json()) as RainViewerManifest;
  manifestCache = { data, expires: Date.now() + 60_000 };
  return data;
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const z = searchParams.get('z');
  const x = searchParams.get('x');
  const y = searchParams.get('y');
  const kindRaw = searchParams.get('kind') ?? 'radar';
  const tsRequested = searchParams.get('ts');

  if (!z || !x || !y) return new Response('missing z/x/y', { status: 400 });
  const kind = kindRaw === 'satellite' ? 'satellite' : 'radar';

  let manifest: RainViewerManifest;
  try {
    manifest = await getManifest();
  } catch {
    return new Response('manifest unavailable', { status: 502 });
  }

  const frames =
    kind === 'satellite'
      ? manifest.satellite.infrared
      : manifest.radar.past;
  if (!frames || frames.length === 0) {
    return new Response('no frames', { status: 404 });
  }

  let frame: RainViewerFrame = frames[frames.length - 1];
  if (tsRequested) {
    const t = Number(tsRequested);
    if (Number.isFinite(t)) {
      frame = frames.reduce((best, f) =>
        Math.abs(f.time - t) < Math.abs(best.time - t) ? f : best,
      );
    }
  }

  // 256/{z}/{x}/{y}/{color}/{smooth}_{snow}.png — color=7 (NWS),
  // smooth=0, snow=1 keeps gates pixelated, which is the look we want.
  const upstream = `${manifest.host}${frame.path}/256/${z}/${x}/${y}/7/0_1.png`;
  try {
    const res = await fetch(upstream);
    if (!res.ok) {
      return new Response(`upstream ${res.status}`, { status: res.status });
    }
    return new Response(res.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=180, s-maxage=180',
        'X-Source': 'rainviewer',
        'X-Frame-Time': String(frame.time),
      },
    });
  } catch {
    return new Response('upstream fetch failed', { status: 502 });
  }
}
