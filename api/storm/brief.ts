// AI storm tracker brief — NWS-grounded summary for the current map view.
// Optional OPENAI_API_KEY polishes wording; the brief always works without it.

import {
  composeStormBrief,
  fetchActiveAlerts,
  polishBriefWithAi,
} from './_lib/compose.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const bbox = searchParams.get('bbox');
  const place = searchParams.get('place')?.trim() || undefined;
  const wantAi = searchParams.get('ai') !== '0';

  try {
    const features = await fetchActiveAlerts(bbox);
    let brief = composeStormBrief(features, { placeLabel: place });
    if (wantAi) brief = await polishBriefWithAi(brief);

    return new Response(JSON.stringify(brief), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'storm brief failed',
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
