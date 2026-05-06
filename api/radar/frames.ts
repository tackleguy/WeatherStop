// Time-frame catalog for the radar scrubber. Returns 13 frames at
// 5-minute intervals covering the last hour, each with the timestamp
// shapes the various tile sources expect:
//
//   • iowaTs  — YYYYMMDDHHMM (Iowa State path segment for historical)
//   • windyTs — epoch seconds rounded to 10-min (Windy path segment)
//
// Iowa State updates ~every 5 min so the cadence lines up with their
// frames. Windy snaps to 10-min on the upstream side, so consecutive
// 5-min frames will sometimes repeat the same Windy ts — expected.

export const config = { runtime: 'edge' };

const FRAME_MIN = 5;
const COUNT = 13;

export default async function handler(): Promise<Response> {
  const now = Date.now();
  const latest = Math.floor(now / (FRAME_MIN * 60_000)) * (FRAME_MIN * 60_000);

  const frames: Array<{
    index: number;
    timestamp: number;
    iso: string;
    iowaTs: string;
    windyTs: number;
    isLive: boolean;
    minutesAgo: number;
  }> = [];

  for (let i = COUNT - 1; i >= 0; i--) {
    const t = latest - i * FRAME_MIN * 60_000;
    const d = new Date(t);
    const iowaTs =
      `${d.getUTCFullYear()}` +
      `${String(d.getUTCMonth() + 1).padStart(2, '0')}` +
      `${String(d.getUTCDate()).padStart(2, '0')}` +
      `${String(d.getUTCHours()).padStart(2, '0')}` +
      `${String(d.getUTCMinutes()).padStart(2, '0')}`;
    const windyTs = Math.floor(t / 600_000) * 600;
    frames.push({
      index: COUNT - 1 - i,
      timestamp: t,
      iso: d.toISOString(),
      iowaTs,
      windyTs,
      isLive: i === 0,
      minutesAgo: i * FRAME_MIN,
    });
  }

  return new Response(
    JSON.stringify({ frames, latest, frameIntervalMin: FRAME_MIN }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    },
  );
}
