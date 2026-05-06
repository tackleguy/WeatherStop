// Frontend-side helpers for shaping NWS responses into our component
// model. The actual fetch happens in /api/alerts; this is just type
// definitions + a normalizer.

import { formatRelativeFuture } from './time';

export interface AlertRow {
  id: string;
  event: string;
  areaDesc: string;
  severity: 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown';
  certainty: string;
  urgency: string;
  expiresRelative: string;
  expires: string;
  effective: string;
  headline: string;
  description: string;
  geometry: GeoJSON.Geometry | null;
}

interface Feature {
  id: string;
  geometry: GeoJSON.Geometry | null;
  properties: Record<string, unknown>;
}

const KNOWN: Record<string, AlertRow['severity']> = {
  extreme: 'extreme',
  severe: 'severe',
  moderate: 'moderate',
  minor: 'minor',
};

export function parseAlerts(json: { features?: Feature[] }): AlertRow[] {
  const rows: AlertRow[] = (json.features ?? []).map((f) => {
    const p = f.properties;
    const sevRaw = String(p.severity ?? '').toLowerCase();
    return {
      id: f.id,
      event: String(p.event ?? 'Alert'),
      areaDesc: String(p.areaDesc ?? ''),
      severity: KNOWN[sevRaw] ?? 'unknown',
      certainty: String(p.certainty ?? ''),
      urgency: String(p.urgency ?? ''),
      expiresRelative: formatRelativeFuture(String(p.expires ?? '')),
      expires: String(p.expires ?? ''),
      effective: String(p.effective ?? ''),
      headline: String(p.headline ?? ''),
      description: String(p.description ?? ''),
      geometry: f.geometry,
    };
  });
  return rows;
}
