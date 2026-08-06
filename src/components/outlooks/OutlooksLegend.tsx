import {
  CAT_LEGEND,
  CIG_LEGEND,
  FIRE_LEGEND,
  PROB_COLORS,
  type OutlookLegendKind,
} from '../../lib/spcOutlooks';

interface Props {
  kind: OutlookLegendKind;
}

export function OutlooksLegend({ kind }: Props) {
  const rows =
    kind === 'cat'
      ? CAT_LEGEND.map((r) => ({ label: r.label, color: r.color }))
      : kind === 'cig'
        ? CIG_LEGEND.map((r) => ({ label: r.label, color: r.color }))
        : kind === 'fire'
          ? FIRE_LEGEND.map((r) => ({ label: r.label, color: r.color }))
          : PROB_COLORS.map((r) => ({ label: r.label, color: r.color }));

  const title =
    kind === 'cat'
      ? 'Categorical risk'
      : kind === 'cig'
        ? 'Conditional intensity'
        : kind === 'fire'
          ? 'Fire weather'
          : 'Probability';

  return (
    <div
      className="pointer-events-none absolute bottom-4 left-3 z-20 rounded-xl border border-[var(--line-default)] px-3 py-2.5 backdrop-blur-[28px]"
      style={{ background: 'var(--glass-hi)' }}
    >
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-4)]">
        {title}
      </div>
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-sm border border-black/20"
              style={{ background: r.color }}
            />
            <span className="text-[11px] font-medium text-[var(--ink-2)]">
              {r.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
