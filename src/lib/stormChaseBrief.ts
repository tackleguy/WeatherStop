// On-device storm brief from NWS AlertRow[] — no cloud required.
// Optional local LLM (Ollama) polish lives in localAi.ts.

import type { AlertRow } from './nwsAlerts';
import {
  alertStorms,
  type StormDanger,
  type StormIntel,
} from './stormIntelligence';

export type ChaseBriefSource = 'local' | 'local+ollama';

export interface ChaseTrackedStorm {
  id: string;
  type: string;
  danger: StormDanger;
  area: string;
  motionLabel?: string;
  motionBearing?: number;
  motionMph?: number;
  center: [number, number];
  radiusKm: number;
}

export interface ChaseBrief {
  generatedAt: string;
  source: ChaseBriefSource;
  headline: string;
  summary: string;
  threats: string[];
  actions: string[];
  storms: ChaseTrackedStorm[];
  alertCount: number;
  severeCount: number;
  nearest?: {
    id: string;
    type: string;
    danger: StormDanger;
    distanceMi: number;
    etaMin?: number;
    bearingDeg?: number;
  };
  disclaimer: string;
}

function haversineMi(
  aLon: number,
  aLat: number,
  bLon: number,
  bLat: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.7613;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const A =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(A));
}

function bearingTo(
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(fromLat);
  const φ2 = toRad(toLat);
  const Δλ = toRad(toLon - fromLon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function compass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
}

function toTracked(s: StormIntel, alert?: AlertRow): ChaseTrackedStorm {
  return {
    id: s.id,
    type: s.type,
    danger: s.danger,
    area: alert?.areaDesc ?? '',
    motionLabel:
      s.motionBearing != null && s.motionMph != null
        ? `Moving ${compass(s.motionBearing)} at ${s.motionMph} mph`
        : undefined,
    motionBearing: s.motionBearing,
    motionMph: s.motionMph,
    center: s.center,
    radiusKm: s.radiusKm,
  };
}

/** Pure local “AI” brief — runs entirely in the browser from alerts you already have. */
export function composeLocalChaseBrief(
  alerts: AlertRow[],
  opts?: {
    center?: [number, number] | null; // lon, lat
    placeLabel?: string;
  },
): ChaseBrief {
  const intel = alertStorms(alerts);
  const byId = new Map(alerts.map((a) => [a.id, a]));
  const storms = intel.map((s) => toTracked(s, byId.get(s.id)));
  const alertCount = alerts.length;
  const severeCount = alerts.filter(
    (a) =>
      a.severity === 'extreme' ||
      a.severity === 'severe' ||
      /tornado|severe thunderstorm/i.test(a.event),
  ).length;

  const place = opts?.placeLabel?.trim() || 'your position';
  const tornadoes = storms.filter((s) => /tornado/i.test(s.type));
  const severe = storms.filter((s) => /severe thunderstorm/i.test(s.type));
  const floods = storms.filter((s) => /flash-flood|flash flood/i.test(s.type));

  const threats: string[] = [];
  if (tornadoes.length) {
    threats.push(
      `${tornadoes.length} tornado warning${tornadoes.length === 1 ? '' : 's'} — drop and cover if you are under one`,
    );
  }
  if (severe.length) {
    threats.push(
      `${severe.length} severe thunderstorm warning${severe.length === 1 ? '' : 's'}`,
    );
  }
  if (floods.length) {
    threats.push(`${floods.length} flash-flood threat${floods.length === 1 ? '' : 's'}`);
  }
  if (!threats.length && alertCount) {
    threats.push(`${alertCount} active NWS alert${alertCount === 1 ? '' : 's'} in view`);
  }
  if (!threats.length) {
    threats.push('No severe convective warnings in this viewport');
  }

  const moving = storms.filter((s) => s.motionLabel);
  if (moving.length) {
    threats.push(
      `Motion (from NWS text): ${moving
        .slice(0, 3)
        .map((s) => `${s.type} — ${s.motionLabel}`)
        .join('; ')}`,
    );
  }

  const actions: string[] = [];
  if (tornadoes.length) {
    actions.push('Never chase into a tornado warning polygon — treat it as immediate life threat');
  }
  if (severe.length) {
    actions.push('Favor right-flank / clear-slot approaches; watch for rear-flank gust front');
  }
  if (floods.length) {
    actions.push('Avoid low water crossings — flash flood kills more chasers than wind');
  }
  actions.push('Keep escape routes open; fuel and phone charge before committing');
  actions.push('This is an on-device summary of official NWS products — not a forecast');

  let nearest: ChaseBrief['nearest'];
  const origin = opts?.center;
  if (origin && storms.length) {
    let best: { storm: ChaseTrackedStorm; mi: number } | null = null;
    for (const storm of storms) {
      const mi = haversineMi(
        origin[0],
        origin[1],
        storm.center[0],
        storm.center[1],
      );
      if (!best || mi < best.mi) best = { storm, mi };
    }
    if (best) {
      const bearing = bearingTo(
        origin[0],
        origin[1],
        best.storm.center[0],
        best.storm.center[1],
      );
      let etaMin: number | undefined;
      if (best.storm.motionMph && best.storm.motionMph > 0) {
        // Rough closing-speed estimate if storm is moving toward viewer.
        const toward =
          best.storm.motionBearing != null
            ? Math.abs(
                ((((best.storm.motionBearing + 180) % 360) - bearing + 540) %
                  360) -
                  180,
              ) < 60
            : false;
        if (toward) {
          etaMin = Math.round((best.mi / best.storm.motionMph) * 60);
        }
      }
      nearest = {
        id: best.storm.id,
        type: best.storm.type,
        danger: best.storm.danger,
        distanceMi: Math.round(best.mi * 10) / 10,
        etaMin,
        bearingDeg: Math.round(bearing),
      };
    }
  }

  let headline: string;
  let summary: string;
  if (tornadoes.length) {
    headline = `Chase alert — tornado warnings near ${place}`;
    summary = `Local tracker sees ${tornadoes.length} tornado warning${tornadoes.length === 1 ? '' : 's'} and ${severeCount} severe-tier product${severeCount === 1 ? '' : 's'}. Circles and paths on the map are NWS-derived. Do not enter warned polygons.`;
  } else if (severe.length) {
    headline = `Severe cells active near ${place}`;
    summary = `${severe.length} severe thunderstorm warning${severe.length === 1 ? '' : 's'} in play. Use velocity/rotation products and keep the storm on your preferred flank.`;
  } else if (alertCount) {
    headline = `Alerts near ${place} — no TOR/SVR locked`;
    summary = `${alertCount} NWS alert${alertCount === 1 ? '' : 's'} visible. Local mode is watching for tornado / severe / flash-flood upgrades.`;
  } else {
    headline = `Quiet chase window near ${place}`;
    summary =
      'No active severe warnings in this view. Pan toward the risk area or wait for convective initiation — the local tracker only reads what’s on screen.';
  }

  if (nearest) {
    summary += ` Nearest tracked cell is ${nearest.distanceMi} mi ${compass(nearest.bearingDeg ?? 0)} (${nearest.type}).`;
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'local',
    headline,
    summary,
    threats,
    actions,
    storms: storms.slice(0, 12),
    alertCount,
    severeCount,
    nearest,
    disclaimer:
      'On-device analysis of National Weather Service alerts. Not an official forecast. Never drive into a tornado warning.',
  };
}
