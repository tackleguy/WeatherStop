import { Moon } from 'lucide-react';
import { useMemo } from 'react';
import { Card } from './Card';
import {
  moonPhaseFor,
  moonSVG,
  nextMoonEventSentence,
} from '../lib/moonPhase';

interface Props {
  /** Optional date override; defaults to "now". */
  date?: Date;
  index?: number;
}

export function MoonCard({ date, index }: Props) {
  const at = date ?? new Date();
  const phase = useMemo(() => moonPhaseFor(at), [at]);
  const svg = useMemo(
    () =>
      moonSVG(at, {
        size: 96,
        litColor: '#f8fafc',
        darkColor: '#0f172a',
        outlineColor: 'rgba(255,255,255,0.22)',
      }),
    [at],
  );
  const next = nextMoonEventSentence(at);

  return (
    <Card title="Moon" icon={Moon} index={index} meta={`${phase.illumination}% lit`}>
      <div className="flex items-center gap-4">
        <div
          aria-hidden
          className="shrink-0"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium text-white">{phase.name}</div>
          <div className="mt-1 text-[12px] text-white/65">
            Age {phase.age.toFixed(1)} days · {phase.illumination}% illuminated
          </div>
          <div className="mt-3 text-[12px] text-white/75">{next}</div>
        </div>
      </div>
    </Card>
  );
}
