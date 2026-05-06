// Windy-style integrated meteogram. Replaces the per-hour cell strip.
// One SVG conveys: temperature trend (filled curve + line + bin labels),
// precipitation probability (sized dots), wind direction (arrows), and
// sunrise/sunset (dashed vertical lines). All hovers are pure visual —
// no interactivity beyond the existing card-tap.

import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { describeNext24h } from '../lib/forecastNarrative';
import { displayTemp } from '../lib/display';
import { formatHourLabel } from '../lib/format';
import type { Settings, WeatherData } from '../types';

interface Props {
  data: WeatherData;
  settings: Settings;
  index?: number;
}

interface SunMark {
  idx: number;
  type: 'sunrise' | 'sunset';
}

function buildSunMarks(
  data: WeatherData,
  hourly: WeatherData['hourly'],
): SunMark[] {
  if (hourly.length === 0) return [];
  const start = new Date(hourly[0].time).getTime();
  const end = new Date(hourly[hourly.length - 1].time).getTime();
  const events: { ts: number; type: 'sunrise' | 'sunset' }[] = [];
  for (const day of data.daily) {
    if (day.sunrise) events.push({ ts: new Date(day.sunrise).getTime(), type: 'sunrise' });
    if (day.sunset) events.push({ ts: new Date(day.sunset).getTime(), type: 'sunset' });
  }
  const marks: SunMark[] = [];
  for (const ev of events) {
    if (ev.ts < start || ev.ts > end) continue;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < hourly.length; i++) {
      const dist = Math.abs(new Date(hourly[i].time).getTime() - ev.ts);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    marks.push({ idx: bestIdx, type: ev.type });
  }
  return marks;
}

export function Meteogram({ data, settings, index }: Props) {
  const hourly = (() => {
    const now = Date.now();
    return data.hourly
      .filter((h) => new Date(h.time).getTime() >= now - 60 * 60_000)
      .slice(0, 24);
  })();

  if (hourly.length < 4) return null;

  const W = 720;
  const H = 220;
  const pad = { l: 18, r: 18, t: 14, b: 32 };

  const tempBandTop = pad.t + 8;
  const tempBandHeight = 70;
  const precipY = tempBandTop + tempBandHeight + 18;
  const windY = precipY + 22;

  const temps = hourly.map((h) => h.temp);
  const minT = Math.min(...temps);
  const maxT = Math.max(...temps);
  const tRange = Math.max(maxT - minT, 1);

  const xFor = (i: number) =>
    pad.l + (i / (hourly.length - 1)) * (W - pad.l - pad.r);
  const yForT = (t: number) =>
    tempBandTop + (1 - (t - minT) / tRange) * tempBandHeight;

  const tempPath = hourly
    .map(
      (h, i) =>
        `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yForT(h.temp).toFixed(1)}`,
    )
    .join(' ');
  const fillPath =
    `${tempPath} L ${xFor(hourly.length - 1).toFixed(1)} ${(tempBandTop + tempBandHeight).toFixed(1)}` +
    ` L ${xFor(0).toFixed(1)} ${(tempBandTop + tempBandHeight).toFixed(1)} Z`;

  const sunMarks = buildSunMarks(data, hourly);
  const tz = data.location.timezone;
  const narrative = describeNext24h(data, settings);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: 0.06 + (index ?? 0) * 0.06,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="panel panel-padded"
    >
      <header className="mb-3 flex items-center gap-2 border-b border-white/[0.06] pb-3">
        <Clock
          className="h-3.5 w-3.5"
          strokeWidth={1.6}
          style={{ color: 'var(--accent)' }}
        />
        <span className="card-label">Hourly Forecast</span>
        <span className="ml-auto card-meta">Next 24h</span>
      </header>

      {narrative ? (
        <p className="mb-3 text-[13px] leading-relaxed text-white/80">
          {narrative}
        </p>
      ) : null}

      <div className="overflow-x-auto no-scrollbar">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-44 w-full min-w-[640px] sm:min-w-0"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="meteogram-temp-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(0,212,255,0.32)" />
              <stop offset="100%" stopColor="rgba(0,212,255,0)" />
            </linearGradient>
          </defs>

          {/* sun markers (under everything else) */}
          {sunMarks.map((m, i) => (
            <g key={`s-${i}`}>
              <line
                x1={xFor(m.idx)}
                y1={pad.t}
                x2={xFor(m.idx)}
                y2={H - pad.b}
                stroke={m.type === 'sunrise' ? '#fbbf24' : '#f97316'}
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={0.55}
              />
              <text
                x={xFor(m.idx)}
                y={H - 14}
                fill={m.type === 'sunrise' ? '#fbbf24' : '#f97316'}
                fontSize="9"
                fontWeight={600}
                textAnchor="middle"
                fontFamily="Inter"
              >
                {m.type === 'sunrise' ? '☀ rise' : '☾ set'}
              </text>
            </g>
          ))}

          {/* temperature curve */}
          <path d={fillPath} fill="url(#meteogram-temp-fill)" />
          <path
            d={tempPath}
            fill="none"
            stroke="white"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* temp labels */}
          {hourly.map((h, i) =>
            i % 4 === 0 ? (
              <text
                key={`t-${i}`}
                x={xFor(i)}
                y={yForT(h.temp) - 6}
                fill="white"
                fontSize="11"
                fontWeight={500}
                textAnchor="middle"
                fontFamily="Inter"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {displayTemp(h.temp, settings)}
              </text>
            ) : null,
          )}

          {/* precip probability dots */}
          {hourly.map((h, i) =>
            h.precipProb > 10 ? (
              <circle
                key={`p-${i}`}
                cx={xFor(i)}
                cy={precipY}
                r={1 + (h.precipProb / 100) * 4}
                fill="rgba(0,212,255,0.7)"
              />
            ) : null,
          )}

          {/* wind arrows */}
          {hourly.map((_h, i) => {
            if (i % 2 !== 0) return null;
            // The canonical hourly array doesn't carry per-hour direction
            // yet; rotate every arrow to current windDirectionDeg so the
            // row still reads as "wind, generally from this direction."
            const dir = data.current.windDirectionDeg;
            return (
              <g
                key={`w-${i}`}
                transform={`translate(${xFor(i)},${windY}) rotate(${dir})`}
              >
                <line
                  x1={0}
                  y1={-5}
                  x2={0}
                  y2={5}
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth={1}
                />
                <polygon
                  points="0,-7 -2.4,-3 2.4,-3"
                  fill="rgba(255,255,255,0.65)"
                />
              </g>
            );
          })}

          {/* hour labels */}
          {hourly.map((h, i) =>
            i % 2 === 0 ? (
              <text
                key={`h-${i}`}
                x={xFor(i)}
                y={H - 4}
                fill="rgba(255,255,255,0.6)"
                fontSize="10"
                textAnchor="middle"
                fontFamily="Inter"
              >
                {i === 0 ? 'Now' : formatHourLabel(h.time, tz)}
              </text>
            ) : null,
          )}
        </svg>
      </div>
    </motion.div>
  );
}
