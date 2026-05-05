// Unit conversions used inside the normalizer and display layer. Kept in
// one place so callers don't reinvent the constants and drift apart.

export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToC = (f: number) => ((f - 32) * 5) / 9;
export const kmhToMph = (k: number) => k * 0.621371;
export const mphToKmh = (m: number) => m * 1.60934;
export const paToHpa = (pa: number) => pa / 100;
export const hpaToInHg = (hpa: number) => hpa * 0.02953;
export const inHgToHpa = (inhg: number) => inhg / 0.02953;
export const metersToMiles = (m: number) => m / 1609.344;
export const milesToKm = (mi: number) => mi * 1.60934;
export const inchToMm = (i: number) => i * 25.4;
