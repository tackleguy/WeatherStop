import type { GolfHole, GolfTeeBox, TeeKind } from './golf';

export function loopNames(holes: GolfHole[]): string[] {
  const names = [...new Set(holes.map((h) => h.loop).filter(Boolean))] as string[];
  return names.sort((a, b) => a.localeCompare(b));
}

export function holesOnLoop(holes: GolfHole[], loop: string | null): GolfHole[] {
  if (!loop) return holes;
  const matched = holes.filter((h) => (h.loop ?? '') === loop);
  return matched.length ? matched : holes;
}

function fallbackTee(hole: GolfHole): GolfTeeBox {
  return {
    id: 'card',
    label: 'Card',
    kind: 'mid',
    yards: hole.yards,
    bearingDeg: hole.bearingDeg,
    tee: hole.tee,
    path: hole.path,
    teeElevationM: hole.teeElevationM,
  };
}

export function teesOnHole(hole: GolfHole): GolfTeeBox[] {
  return hole.tees?.length ? hole.tees : [fallbackTee(hole)];
}

export function pickTee(hole: GolfHole, kind: TeeKind): GolfTeeBox {
  const tees = teesOnHole(hole);
  const matching = tees.filter((t) => t.kind === kind);
  if (matching.length === 1) return matching[0]!;
  if (matching.length > 1) {
    const sorted = [...matching].sort((a, b) => b.yards - a.yards);
    return sorted[Math.floor(sorted.length / 2)]!;
  }
  const sorted = [...tees].sort((a, b) => b.yards - a.yards);
  if (kind === 'back') return sorted[0]!;
  if (kind === 'front') return sorted[sorted.length - 1]!;
  return sorted[Math.floor(sorted.length / 2)]!;
}

export function applyTee(hole: GolfHole, kind: TeeKind): GolfHole {
  const tee = pickTee(hole, kind);
  return {
    ...hole,
    yards: tee.yards,
    bearingDeg: tee.bearingDeg,
    tee: tee.tee,
    path: tee.path ?? [tee.tee, hole.green],
    teeElevationM: tee.teeElevationM,
  };
}

export function teeKindLabel(kind: TeeKind): string {
  if (kind === 'back') return 'Back';
  if (kind === 'front') return 'Front';
  return 'Middle';
}

const TEE_ORDER: TeeKind[] = ['back', 'mid', 'front'];

export function availableTeeKinds(holes: GolfHole[]): TeeKind[] {
  const kinds = new Set<TeeKind>();
  for (const hole of holes) {
    for (const tee of teesOnHole(hole)) kinds.add(tee.kind);
  }
  return TEE_ORDER.filter((kind) => kinds.has(kind));
}

export function pickLoopForCourse(courseName: string, loops: string[]): string | null {
  if (!loops.length) return null;
  const n = courseName.toLowerCase();
  const named = loops.find((loop) => n.includes(loop.toLowerCase()));
  if (named) return named;
  return loops.length === 1 ? loops[0]! : loops[0]!;
}
