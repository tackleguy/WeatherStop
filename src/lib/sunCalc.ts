// Sunrise / sunset using the standard NOAA solar position approximation.
// Accuracy is within a minute or two for typical latitudes — good enough for
// the SunCard horizon arc when an external source isn't available.

const J2000 = 2451545.0;
const RAD = Math.PI / 180;

function toJulian(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

function fromJulian(j: number): Date {
  return new Date((j - 2440587.5) * 86_400_000);
}

interface SunTimes {
  sunrise: Date | null;
  sunset: Date | null;
}

export function sunTimes(lat: number, lon: number, date: Date): SunTimes {
  const noonish = new Date(date);
  noonish.setUTCHours(12, 0, 0, 0);

  const n = Math.round(toJulian(noonish) - J2000 - 0.0009 - lon / 360);
  const Jstar = J2000 + 0.0009 + lon / 360 + n;

  const M = (357.5291 + 0.98560028 * (Jstar - J2000)) % 360;
  const Mrad = M * RAD;

  const C =
    1.9148 * Math.sin(Mrad) +
    0.02 * Math.sin(2 * Mrad) +
    0.0003 * Math.sin(3 * Mrad);

  const lambda = ((M + C + 180 + 102.9372) % 360) * RAD;
  const Jtransit =
    Jstar + 0.0053 * Math.sin(Mrad) - 0.0069 * Math.sin(2 * lambda);

  const decl = Math.asin(Math.sin(lambda) * Math.sin(23.4397 * RAD));
  const latRad = lat * RAD;

  const cosOmega =
    (Math.sin(-0.83 * RAD) - Math.sin(latRad) * Math.sin(decl)) /
    (Math.cos(latRad) * Math.cos(decl));

  if (cosOmega < -1) return { sunrise: null, sunset: null }; // polar day
  if (cosOmega > 1) return { sunrise: null, sunset: null }; // polar night

  const omega = (Math.acos(cosOmega) * 180) / Math.PI;
  return {
    sunrise: fromJulian(Jtransit - omega / 360),
    sunset: fromJulian(Jtransit + omega / 360),
  };
}

// Local-day "is the sun up?" check, used to derive is_day at arbitrary times.
export function isDaytime(lat: number, lon: number, when: Date): boolean {
  const { sunrise, sunset } = sunTimes(lat, lon, when);
  if (!sunrise || !sunset) {
    // Fallback: sun is up June, down December at high latitudes.
    return when.getUTCMonth() >= 3 && when.getUTCMonth() <= 9;
  }
  const t = when.getTime();
  return t >= sunrise.getTime() && t <= sunset.getTime();
}
