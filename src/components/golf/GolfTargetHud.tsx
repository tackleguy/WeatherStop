import type { BagClub } from '../../lib/golfProfile';
import {
  measureFromTee,
  nearestBagClub,
  segmentPlaysLike,
  type MeasureSplit,
} from '../../lib/golfMeasure';
import type { GolfHole, HoleBrief } from '../../lib/golf';
import type { LonLat } from '../../lib/golfWind';

interface Props {
  hole: GolfHole;
  target: LonLat;
  bag: BagClub[];
  brief?: HoleBrief;
  elevFt: number;
  onReset: () => void;
}

export function GolfTargetHud({
  hole,
  target,
  bag,
  brief,
  elevFt,
  onReset,
}: Props) {
  const split: MeasureSplit = measureFromTee(hole, target);
  const carryClub = nearestBagClub(split.carryYards, bag);
  const remainClub = nearestBagClub(split.remainYards, bag);
  const windAdj = brief?.windAdjustmentYards ?? 0;
  const slope = brief?.slopeYards ?? 0;
  const carryPlays = segmentPlaysLike(
    split.carryYards,
    hole.yards,
    windAdj,
    slope,
    elevFt,
  );
  const remainPlays = segmentPlaysLike(
    split.remainYards,
    hole.yards,
    windAdj,
    slope,
    elevFt,
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center px-3 lg:top-auto lg:bottom-4 lg:right-[352px] lg:left-3 lg:inset-x-auto lg:justify-start">
      <div
        className="pointer-events-auto w-full max-w-[420px] rounded-xl border border-white/15 px-3 py-2.5 shadow-xl backdrop-blur-[28px]"
        style={{ background: 'var(--glass-hi)' }}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
            Tee planner · tap the map
          </span>
          <button
            type="button"
            onClick={onReset}
            className="rounded-md px-1.5 py-0.5 text-[10px] text-[var(--ink-3)] hover:bg-white/10 hover:text-[var(--ink-1)]"
          >
            Reset landing
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-black/30 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wide text-[var(--ink-4)]">
              Tee → target
            </div>
            <div className="text-[22px] font-semibold tabular-nums leading-tight text-[var(--ink-1)]">
              {split.carryYards}
              <span className="ml-0.5 text-[11px] font-medium text-[var(--ink-3)]">
                yd
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--accent)]">
              {carryClub
                ? `${carryClub.label} · ${carryClub.yards} tot avg`
                : '—'}
              {' · '}plays {carryPlays}
            </div>
          </div>
          <div className="rounded-lg bg-black/30 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wide text-[var(--ink-4)]">
              Target → green
            </div>
            <div className="text-[22px] font-semibold tabular-nums leading-tight text-[var(--ink-1)]">
              {split.remainYards}
              <span className="ml-0.5 text-[11px] font-medium text-[var(--ink-3)]">
                yd
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--accent)]">
              {remainClub
                ? `${remainClub.label} · ${remainClub.yards} tot avg`
                : '—'}
              {' · '}plays {remainPlays}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
