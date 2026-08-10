// Storm-cell geometry helpers shared by the AI storm-analysis API.
// Builds MapLibre-ready GeoJSON: identification boxes, motion paths,
// severe spots, and tornado formation / track markers from NWS alerts
// (optionally enriched by a local LLM).

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
  confidence: number; // 0..1
  event?: string;
  source?: 'nws' | 'ai';
  minutesAhead?: number;
  fill?: string;
  stroke?: string;
}

export interface SlimAlert {
  id: string;
  event: string;
  severity: StormSeverity;
  headline: string;
  description: string;
  areaDesc: string;
  geometry: GeoJSON.Geometry | null;
}

export interface StormAnalysisResult {
  type: 'FeatureCollection';
  features: GeoJSON.Feature[];
  summary: {
    stormCount: number;
    tornadoThreats: number;
    severeSpots: number;
    source: 'nws+ai' | 'nws' | 'empty';
    note: string;
  };
}

const SEVERE_RE =
  /tornado|severe\s+thunderstorm|flash\s+flood\s+warning/i;
const TORNADO_RE = /tornado/i;
const TOR_WARN_RE = /tornado\s+warning/i;
const TOR_WATCH_RE = /tornado\s+watch/i;
const TOR_POSSIBLE_RE =
  /tornado\.{0,3}\s*(radar\s+indicated|possible|observed)|tornadoes?\s+possible/i;

const KIND_COLORS: Record<StormKind, { fill: string; stroke: string }> = {
  box: { fill: '#f59e0b', stroke: '#fbbf24' },
  path: { fill: '#38bdf8', stroke: '#38bdf8' },
  severe: { fill: '#ef4444', stroke: '#fecaca' },
  tornado: { fill: '#d946ef', stroke: '#f0abfc' },
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function collectCoords(
  geometry: GeoJSON.Geometry,
  out: Array<[number, number]> = [],
): Array<[number, number]> {
  switch (geometry.type) {
    case 'Point':
      out.push(geometry.coordinates as [number, number]);
      break;
    case 'MultiPoint':
    case 'LineString':
      for (const c of geometry.coordinates) out.push(c as [number, number]);
      break;
    case 'MultiLineString':
    case 'Polygon':
      for (const ring of geometry.coordinates)
        for (const c of ring) out.push(c as [number, number]);
      break;
    case 'MultiPolygon':
      for (const poly of geometry.coordinates)
        for (const ring of poly)
          for (const c of ring) out.push(c as [number, number]);
      break;
    case 'GeometryCollection':
      for (const g of geometry.geometries) collectCoords(g, out);
      break;
  }
  return out;
}

export function geometryBBox(
  geometry: GeoJSON.Geometry,
): [number, number, number, number] | null {
  const coords = collectCoords(geometry);
  if (coords.length === 0) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  if (!Number.isFinite(minLon)) return null;
  return [minLon, minLat, maxLon, maxLat];
}

export function centroidOf(
  geometry: GeoJSON.Geometry,
): [number, number] | null {
  const bbox = geometryBBox(geometry);
  if (!bbox) return null;
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

/** Destination point given start lon/lat, bearing degrees, and distance miles. */
export function destinationPoint(
  lon: number,
  lat: number,
  bearingDeg: number,
  miles: number,
): [number, number] {
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const δ = miles / R;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(lat);
  const λ1 = toRad(lon);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return [((toDeg(λ2) + 540) % 360) - 180, toDeg(φ2)];
}

export interface StormMotion {
  bearingDeg: number;
  speedMph: number;
  source: string;
}

/** Parse NWS TIME...MOT...LOC or free-text storm motion. */
export function parseStormMotion(text: string): StormMotion | null {
  const mot = text.match(
    /TIME\.{0,3}MOT\.{0,3}LOC\s+\S+\s+(\d{1,3})\s*DEG\s+(\d{1,3})\s*KT/i,
  );
  if (mot) {
    const bearing = Number(mot[1]);
    const kt = Number(mot[2]);
    if (Number.isFinite(bearing) && Number.isFinite(kt)) {
      return {
        bearingDeg: bearing,
        speedMph: kt * 1.15078,
        source: 'TIME...MOT...LOC',
      };
    }
  }

  const toward = text.match(
    /(?:storm\s+)?motion\s+toward\s+the\s+(\w+(?:\s+\w+)?)\s+at\s+(\d{1,3})\s*mph/i,
  );
  if (toward) {
    const dir = toward[1].toLowerCase().replace(/\s+/g, '');
    const mph = Number(toward[2]);
    const dirs: Record<string, number> = {
      north: 0,
      nne: 22.5,
      northeast: 45,
      ne: 45,
      ene: 67.5,
      east: 90,
      ese: 112.5,
      southeast: 135,
      se: 135,
      sse: 157.5,
      south: 180,
      ssw: 202.5,
      southwest: 225,
      sw: 225,
      wsw: 247.5,
      west: 270,
      wnw: 292.5,
      northwest: 315,
      nw: 315,
      nnw: 337.5,
    };
    if (dir in dirs && Number.isFinite(mph)) {
      return { bearingDeg: dirs[dir], speedMph: mph, source: 'text motion' };
    }
  }

  return null;
}

function padBBox(
  bbox: [number, number, number, number],
  padDeg: number,
): [number, number, number, number] {
  return [
    bbox[0] - padDeg,
    bbox[1] - padDeg,
    bbox[2] + padDeg,
    bbox[3] + padDeg,
  ];
}

function boxPolygon(
  bbox: [number, number, number, number],
): GeoJSON.Polygon {
  const [w, s, e, n] = bbox;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
        [w, s],
      ],
    ],
  };
}

function feature(
  props: StormFeatureProps,
  geometry: GeoJSON.Geometry,
): GeoJSON.Feature {
  const colors = KIND_COLORS[props.kind];
  return {
    type: 'Feature',
    properties: {
      ...props,
      fill: props.fill ?? colors.fill,
      stroke: props.stroke ?? colors.stroke,
    },
    geometry,
  };
}

function isSevereCandidate(alert: SlimAlert): boolean {
  return SEVERE_RE.test(alert.event) || SEVERE_RE.test(alert.headline);
}

function confidenceFor(alert: SlimAlert): number {
  if (TOR_WARN_RE.test(alert.event)) return 0.92;
  if (TOR_WATCH_RE.test(alert.event)) return 0.7;
  if (/severe\s+thunderstorm\s+warning/i.test(alert.event)) return 0.8;
  if (/severe\s+thunderstorm\s+watch/i.test(alert.event)) return 0.6;
  return 0.55;
}

/** Deterministic storm overlay from NWS alerts in the viewport. */
export function buildStormFeaturesFromAlerts(
  alerts: SlimAlert[],
): GeoJSON.Feature[] {
  const out: GeoJSON.Feature[] = [];

  for (const alert of alerts) {
    if (!alert.geometry || !isSevereCandidate(alert)) continue;
    const bbox = geometryBBox(alert.geometry);
    const center = centroidOf(alert.geometry);
    if (!bbox || !center) continue;

    const stormId = alert.id;
    const isTornado = TORNADO_RE.test(alert.event);
    const conf = confidenceFor(alert);
    const text = `${alert.headline}\n${alert.description}`;
    const motion =
      parseStormMotion(text) ??
      ({
        bearingDeg: isTornado ? 45 : 55,
        speedMph: isTornado ? 35 : 30,
        source: 'default NE storm motion',
      } satisfies StormMotion);

    // Identification box around the storm / warning polygon.
    const pad = Math.max((bbox[2] - bbox[0]) * 0.08, 0.05);
    out.push(
      feature(
        {
          kind: 'box',
          stormId,
          label: isTornado ? `Tornado cell · ${alert.event}` : `Storm · ${alert.event}`,
          detail: alert.areaDesc || alert.headline,
          severity: alert.severity,
          confidence: conf,
          event: alert.event,
          source: 'nws',
          fill: isTornado ? '#d946ef' : '#f59e0b',
          stroke: isTornado ? '#f0abfc' : '#fde68a',
        },
        boxPolygon(padBBox(bbox, pad)),
      ),
    );

    // Potential path: now → 30 min → 60 min along motion vector.
    const d30 = destinationPoint(
      center[0],
      center[1],
      motion.bearingDeg,
      (motion.speedMph * 30) / 60,
    );
    const d60 = destinationPoint(
      center[0],
      center[1],
      motion.bearingDeg,
      (motion.speedMph * 60) / 60,
    );
    out.push(
      feature(
        {
          kind: 'path',
          stormId,
          label: `Path · ${Math.round(motion.speedMph)} mph @ ${Math.round(motion.bearingDeg)}°`,
          detail: `Projected 60-min track (${motion.source})`,
          severity: alert.severity,
          confidence: clamp(conf - 0.1, 0.35, 0.95),
          event: alert.event,
          source: 'nws',
          minutesAhead: 60,
        },
        {
          type: 'LineString',
          coordinates: [center, d30, d60],
        },
      ),
    );

    // Path endpoint markers as severe / tornado spots.
    if (isTornado || TOR_POSSIBLE_RE.test(text)) {
      out.push(
        feature(
          {
            kind: 'tornado',
            stormId,
            label: TOR_WARN_RE.test(alert.event)
              ? 'Tornado indicated / warned'
              : 'Tornado formation risk',
            detail: alert.headline || alert.event,
            severity: alert.severity === 'unknown' ? 'severe' : alert.severity,
            confidence: conf,
            event: alert.event,
            source: 'nws',
          },
          { type: 'Point', coordinates: center },
        ),
      );
      out.push(
        feature(
          {
            kind: 'tornado',
            stormId,
            label: 'Projected tornado path (60 min)',
            detail: `Along ${Math.round(motion.bearingDeg)}° track`,
            severity: 'extreme',
            confidence: clamp(conf - 0.15, 0.3, 0.9),
            event: alert.event,
            source: 'nws',
            minutesAhead: 60,
          },
          { type: 'Point', coordinates: d60 },
        ),
      );
    } else {
      out.push(
        feature(
          {
            kind: 'severe',
            stormId,
            label: 'Severe weather core',
            detail: alert.headline || alert.event,
            severity: alert.severity,
            confidence: conf,
            event: alert.event,
            source: 'nws',
          },
          { type: 'Point', coordinates: center },
        ),
      );
      out.push(
        feature(
          {
            kind: 'severe',
            stormId,
            label: 'Potential severe spot (60 min)',
            detail: `Projected impact along storm motion`,
            severity: alert.severity,
            confidence: clamp(conf - 0.2, 0.3, 0.85),
            event: alert.event,
            source: 'nws',
            minutesAhead: 60,
          },
          { type: 'Point', coordinates: d60 },
        ),
      );
    }
  }

  return out;
}

export function summarizeFeatures(
  features: GeoJSON.Feature[],
  source: StormAnalysisResult['summary']['source'],
  note: string,
): StormAnalysisResult['summary'] {
  const stormIds = new Set<string>();
  let tornadoThreats = 0;
  let severeSpots = 0;
  for (const f of features) {
    const p = f.properties as StormFeatureProps | null;
    if (!p) continue;
    if (p.stormId) stormIds.add(p.stormId);
    if (p.kind === 'tornado') tornadoThreats += 1;
    if (p.kind === 'severe') severeSpots += 1;
  }
  return {
    stormCount: stormIds.size,
    tornadoThreats,
    severeSpots,
    source,
    note,
  };
}

/** Extract a JSON object from an LLM reply (raw or fenced). */
export function extractJsonObject(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

interface AiEnrichment {
  storms?: Array<{
    stormId?: string;
    label?: string;
    detail?: string;
    tornadoRisk?: string;
    confidence?: number;
  }>;
  note?: string;
}

/** Merge LLM labels / confidence onto deterministic features. */
export function applyAiEnrichment(
  features: GeoJSON.Feature[],
  enrichment: unknown,
): { features: GeoJSON.Feature[]; note: string | null } {
  const parsed = enrichment as AiEnrichment | null;
  if (!parsed || typeof parsed !== 'object') {
    return { features, note: null };
  }
  const byId = new Map(
    (parsed.storms ?? [])
      .filter((s) => s && typeof s.stormId === 'string')
      .map((s) => [s.stormId as string, s]),
  );

  const next = features.map((f) => {
    const props = { ...(f.properties as StormFeatureProps) };
    const e = byId.get(props.stormId);
    if (!e) return f;
    if (typeof e.label === 'string' && e.label.trim()) {
      if (props.kind === 'box') props.label = e.label.trim();
    }
    if (typeof e.detail === 'string' && e.detail.trim()) {
      props.detail = e.detail.trim();
    }
    if (
      typeof e.tornadoRisk === 'string' &&
      e.tornadoRisk.trim() &&
      (props.kind === 'tornado' || props.kind === 'box')
    ) {
      props.detail = `${props.detail} · ${e.tornadoRisk.trim()}`;
    }
    if (typeof e.confidence === 'number' && Number.isFinite(e.confidence)) {
      props.confidence = clamp(e.confidence, 0, 1);
    }
    props.source = 'ai';
    return { ...f, properties: props };
  });

  return {
    features: next,
    note: typeof parsed.note === 'string' ? parsed.note : null,
  };
}

export function emptyStormAnalysis(note: string): StormAnalysisResult {
  return {
    type: 'FeatureCollection',
    features: [],
    summary: {
      stormCount: 0,
      tornadoThreats: 0,
      severeSpots: 0,
      source: 'empty',
      note,
    },
  };
}
