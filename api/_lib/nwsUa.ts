// NOAA/NWS require a contactable User-Agent on server-side requests.
// Override in Vercel with NWS_USER_AGENT="(your.domain, you@email.com)".

export const NWS_USER_AGENT =
  process.env.NWS_USER_AGENT ??
  '(weather-stop.vercel.app, contact@weatherstop.app)';
