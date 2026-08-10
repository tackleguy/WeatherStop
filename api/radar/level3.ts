// Unidata NEXRAD Level 3 → PNG. Free public S3 bucket:
//   https://unidata-nexrad-level3.s3.amazonaws.com/
//
// Products:
//   N0S — storm-relative velocity radial PNG
//   ROT — azimuthal shear derived from N0S (rotation product)
//   N0C — correlation coefficient (digital dual-pol)
//
// File naming: SSS_PPP_YYYY_MM_DD_HH_MM_SS where SSS is the site
// without a leading K (KFWS → FWS).

import { put, list } from '@vercel/blob';
import { bboxForSite } from '../_lib/nexradSites.js';
import {
  listLatestL3Key,
  parseL3Buffer,
  renderCorrelationPng,
  renderVelocityOrShearPng,
  siteCode,
  type L3ProductCode,
} from '../_lib/level3Render.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url, 'https://x');
  const siteRaw = searchParams.get('site');
  const productRaw = (searchParams.get('product') ?? 'N0S').toUpperCase();

  if (!siteRaw || !/^[A-Za-z]{3,4}$/.test(siteRaw)) {
    return new Response('invalid site', { status: 400 });
  }

  const siteIcao =
    siteRaw.toUpperCase().length === 3
      ? `K${siteRaw.toUpperCase()}`
      : siteRaw.toUpperCase();
  const site3 = siteCode(siteIcao);

  let product: L3ProductCode = 'N0S';
  if (productRaw === 'ROT') product = 'ROT';
  else if (productRaw === 'N0C' || productRaw === 'CC') product = 'N0C';

  const fetchCode = product === 'N0C' ? 'N0C' : 'N0S';
  const cacheKey = `l3v3/${site3}/${product}/latest.png`;
  const TTL_MS = 5 * 60_000;
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (hasBlob) {
    try {
      const existing = await list({ prefix: cacheKey, limit: 1 });
      if (existing.blobs.length > 0) {
        const blob = existing.blobs[0];
        const age = Date.now() - new Date(blob.uploadedAt).getTime();
        if (age < TTL_MS) {
          return Response.json({
            url: blob.url,
            bbox: bboxForSite(siteIcao),
            timestamp: blob.uploadedAt,
            site: siteIcao,
            product,
            cached: true,
          });
        }
      }
    } catch {
      // Blob miss → render fresh.
    }
  }

  const latestKey = await listLatestL3Key(site3, fetchCode);
  if (!latestKey) {
    return new Response('no Level 3 data available', { status: 404 });
  }

  const fileRes = await fetch(
    `https://unidata-nexrad-level3.s3.amazonaws.com/${latestKey}`,
  );
  if (!fileRes.ok) return new Response('L3 fetch failed', { status: 502 });
  const buffer = Buffer.from(await fileRes.arrayBuffer());

  let parsed;
  try {
    parsed = parseL3Buffer(buffer);
  } catch (err) {
    return new Response(
      `L3 parse failed: ${err instanceof Error ? err.message : 'error'}`,
      { status: 502 },
    );
  }

  const packet = parsed.radialPackets?.[0];
  if (!packet?.radials?.length) {
    return new Response('no radial data', { status: 404 });
  }

  let png: Buffer;
  if (product === 'N0C') {
    const plot = parsed.productDescription?.plot;
    png = renderCorrelationPng(
      packet,
      plot?.minimumDataValue ?? 0.2,
      plot?.dataIncrement ?? 0.00333,
    );
  } else {
    const maxNeg = parsed.productDescription?.maxNegativeVelocity ?? -60;
    const maxPos = parsed.productDescription?.maxPositiveVelocity ?? 60;
    png = renderVelocityOrShearPng(
      packet,
      maxNeg,
      maxPos,
      product === 'ROT' ? 'shear' : 'velocity',
    );
  }

  if (hasBlob) {
    try {
      const blob = await put(cacheKey, png, {
        access: 'public',
        contentType: 'image/png',
        cacheControlMaxAge: 300,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return Response.json({
        url: blob.url,
        bbox: bboxForSite(siteIcao),
        timestamp: new Date().toISOString(),
        site: siteIcao,
        product,
        cached: false,
      });
    } catch {
      // fall through to inline
    }
  }

  const [w, s, e, n] = bboxForSite(siteIcao);
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Source': 'level3-direct',
      'X-Site': siteIcao,
      'X-Product': product,
      'X-Bbox': `${w},${s},${e},${n}`,
    },
  });
}
