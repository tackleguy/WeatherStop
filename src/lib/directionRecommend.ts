// Rank chase viewing spots and optionally let local AI pick + fill destination.

import type { ViewingSpot } from './chaseViewing';
import type { ChaseBrief } from './stormChaseBrief';
import type { LocalAiSettings } from './localAi';
import { chatForJson } from './localAi';

export interface DestinationPick {
  spotId: string;
  label: string;
  /** lon, lat */
  center: [number, number];
  kind: ViewingSpot['kind'];
  reason: string;
  source: 'ranked' | 'local-ai';
  driveMi?: number;
}

/** Prefer closer footage perches on the highest-danger storms. */
export function rankDestinationSpots(spots: ViewingSpot[]): ViewingSpot[] {
  const kindRank: Record<ViewingSpot['kind'], number> = {
    footage: 3,
    structure: 2,
    wide: 1,
  };
  return [...spots].sort((a, b) => {
    const driveA = a.driveMi ?? 999;
    const driveB = b.driveMi ?? 999;
    if (driveA !== driveB) return driveA - driveB;
    return kindRank[b.kind] - kindRank[a.kind];
  });
}

export function pickRankedDestination(
  spots: ViewingSpot[],
): DestinationPick | null {
  const ranked = rankDestinationSpots(spots);
  const top = ranked[0];
  if (!top) return null;
  return {
    spotId: top.id,
    label: top.label,
    center: top.center,
    kind: top.kind,
    driveMi: top.driveMi,
    source: 'ranked',
    reason:
      top.kind === 'footage'
        ? `Closest footage perch (~${top.driveMi ?? '?'} mi) outside the warned core — ${top.tip}`
        : `${top.label} (~${top.driveMi ?? '?'} mi) — ${top.tip}`,
  };
}

/**
 * Ask local AI to choose among candidate spots. Always falls back to the
 * deterministic ranker if the model is offline or returns an unknown id.
 */
export async function recommendDestination(
  spots: ViewingSpot[],
  brief: ChaseBrief,
  settings: LocalAiSettings,
  intent?: string,
  signal?: AbortSignal,
): Promise<DestinationPick | null> {
  const fallback = pickRankedDestination(spots);
  if (!spots.length) return null;

  const candidates = rankDestinationSpots(spots).slice(0, 8).map((s) => ({
    id: s.id,
    label: s.label,
    kind: s.kind,
    tip: s.tip,
    driveMi: s.driveMi,
    lon: s.center[0],
    lat: s.center[1],
  }));

  try {
    const user = [
      'Pick ONE chase viewing destination from candidates only.',
      'Return JSON only: { "spotId": "<id from list>", "reason": "1-2 short sentences" }',
      'Never invent coordinates. Prefer life safety over the shot. Avoid tornado-warning cores.',
      intent?.trim()
        ? `Chaser intent: ${intent.trim()}`
        : 'Chaser intent: best place to observe / film from a safe perch',
      `Brief: ${JSON.stringify({
        headline: brief.headline,
        nearest: brief.nearest,
        threats: brief.threats.slice(0, 4),
      })}`,
      `Candidates: ${JSON.stringify(candidates)}`,
    ].join('\n');

    const parsed = await chatForJson(user, settings, signal);
    const spotId = String(parsed?.spotId ?? '').trim();
    const match = spots.find((s) => s.id === spotId);
    if (match) {
      return {
        spotId: match.id,
        label: match.label,
        center: match.center,
        kind: match.kind,
        driveMi: match.driveMi,
        source: 'local-ai',
        reason:
          String(parsed?.reason ?? '').trim() ||
          `AI selected ${match.label} from NWS-grounded candidates.`,
      };
    }
  } catch {
    // fall through
  }

  return fallback;
}
