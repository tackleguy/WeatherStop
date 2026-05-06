// Returns the list of frame timestamps (epoch seconds, 5-min cadence)
// available for scrubbing. Today this is a generated rolling window —
// last 60 minutes — because both Windy and the NOAA mapservices return
// the closest frame to a given timestamp without us having to enumerate.
//
// Once we add server-side caching on the radar overlay, this is where we
// would expose the actual cached list.

export const config = { runtime: 'edge' };

const WINDOW_MINUTES = 60;
const STEP_MINUTES = 5;

export default async function handler(): Promise<Response> {
  const now = Math.floor(Date.now() / 1000 / 600) * 600;
  const frames: number[] = [];
  for (let m = WINDOW_MINUTES; m >= 0; m -= STEP_MINUTES) {
    frames.push(now - m * 60);
  }
  return new Response(
    JSON.stringify({ frames, stepMinutes: STEP_MINUTES, generatedAt: now }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    },
  );
}
