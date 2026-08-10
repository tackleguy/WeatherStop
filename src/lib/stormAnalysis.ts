// Client types + helpers for AI storm overlays on the radar map.

export type StormKind = 'box' | 'path' | 'severe' | 'tornado';

export type StormSeverity =
  | 'extreme'
  | 'severe'
  | 'moderate'
  | 'minor'
  | 'unknown';

export interface StormFeatureProps {
  kind: StormKind;
  stormId: string;
  label: string;
  detail: string;
  severity: StormSeverity;
  confidence: number;
  event?: string;
  source?: 'nws' | 'ai';
  minutesAhead?: number;
  fill?: string;
  stroke?: string;
}

export interface StormAnalysisSummary {
  stormCount: number;
  tornadoThreats: number;
  severeSpots: number;
  source: 'nws+ai' | 'nws' | 'empty';
  note: string;
}

export interface StormAnalysisResult {
  type: 'FeatureCollection';
  features: GeoJSON.Feature[];
  summary: StormAnalysisSummary;
}

export function propsOf(
  feature: GeoJSON.Feature | null | undefined,
): StormFeatureProps | null {
  if (!feature?.properties) return null;
  const p = feature.properties as Partial<StormFeatureProps>;
  if (
    p.kind !== 'box' &&
    p.kind !== 'path' &&
    p.kind !== 'severe' &&
    p.kind !== 'tornado'
  ) {
    return null;
  }
  return {
    kind: p.kind,
    stormId: String(p.stormId ?? ''),
    label: String(p.label ?? 'Storm'),
    detail: String(p.detail ?? ''),
    severity: (p.severity as StormSeverity) ?? 'unknown',
    confidence:
      typeof p.confidence === 'number' && Number.isFinite(p.confidence)
        ? p.confidence
        : 0.5,
    event: p.event,
    source: p.source,
    minutesAhead: p.minutesAhead,
    fill: p.fill,
    stroke: p.stroke,
  };
}

/** Unique storms for the panel list (prefer box features). */
export function listStormCards(
  result: StormAnalysisResult | null,
): StormFeatureProps[] {
  if (!result) return [];
  const boxes = result.features
    .map(propsOf)
    .filter((p): p is StormFeatureProps => Boolean(p) && p!.kind === 'box');
  if (boxes.length > 0) return boxes;

  const seen = new Set<string>();
  const cards: StormFeatureProps[] = [];
  for (const f of result.features) {
    const p = propsOf(f);
    if (!p || seen.has(p.stormId)) continue;
    seen.add(p.stormId);
    cards.push(p);
  }
  return cards;
}
