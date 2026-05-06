// Stub. NOAA mapservices does not host the GOES bands as ImageServer
// services (verified against the public service catalog) — we use SSEC
// RealEarth tiles direct from the browser instead. This route stays in
// the codebase so the deployment surface area matches the architecture
// doc, and so we have a place to add a server-side cache later if we
// ever switch to a paid GOES tile source.

export const config = { runtime: 'edge' };

export default async function handler(): Promise<Response> {
  return new Response(
    'Satellite served direct from realearth.ssec.wisc.edu — see useSatelliteLayer.',
    { status: 410 },
  );
}
