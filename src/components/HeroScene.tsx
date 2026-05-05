import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Props {
  code: number;
  isDay: boolean;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

// ── individual scenes ─────────────────────────────────────────────────────

function SunScene({ reduced }: { reduced: boolean }) {
  const rays = Array.from({ length: 12 });
  return (
    <svg viewBox="0 0 240 200" className="h-full w-full">
      <defs>
        <radialGradient id="sun-body">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="55%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="sun-glow">
          <stop offset="0%" stopColor="rgba(253,224,71,0.55)" />
          <stop offset="100%" stopColor="rgba(253,224,71,0)" />
        </radialGradient>
      </defs>
      {/* glow */}
      <circle cx="120" cy="100" r="92" fill="url(#sun-glow)" />
      {/* rays */}
      <motion.g
        animate={reduced ? undefined : { rotate: 360 }}
        transition={
          reduced ? undefined : { duration: 70, repeat: Infinity, ease: 'linear' }
        }
        style={{ transformOrigin: '120px 100px' }}
        stroke="rgba(253,224,71,0.85)"
        strokeWidth="3"
        strokeLinecap="round"
      >
        {rays.map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const inner = 50;
          const outer = i % 2 === 0 ? 78 : 70;
          return (
            <line
              key={i}
              x1={120 + Math.cos(a) * inner}
              y1={100 + Math.sin(a) * inner}
              x2={120 + Math.cos(a) * outer}
              y2={100 + Math.sin(a) * outer}
            />
          );
        })}
      </motion.g>
      {/* body */}
      <motion.circle
        cx="120"
        cy="100"
        r="36"
        fill="url(#sun-body)"
        animate={reduced ? undefined : { scale: [1, 1.04, 1] }}
        transition={
          reduced ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }
        }
        style={{ transformOrigin: '120px 100px' }}
      />
    </svg>
  );
}

function MoonScene({ reduced }: { reduced: boolean }) {
  const stars = [
    { cx: 50, cy: 40, r: 1.5, d: 0 },
    { cx: 80, cy: 80, r: 1, d: 0.6 },
    { cx: 180, cy: 60, r: 1.6, d: 1.2 },
    { cx: 200, cy: 130, r: 1.2, d: 1.8 },
    { cx: 60, cy: 150, r: 1, d: 2.4 },
    { cx: 165, cy: 30, r: 1, d: 0.8 },
  ];
  return (
    <svg viewBox="0 0 240 200" className="h-full w-full">
      <defs>
        <radialGradient id="moon-glow">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="100" r="84" fill="url(#moon-glow)" />
      {stars.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          fill="rgba(255,255,255,0.95)"
          animate={
            reduced ? undefined : { opacity: [0.4, 1, 0.4] }
          }
          transition={
            reduced
              ? undefined
              : {
                  duration: 3 + (i % 3),
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: s.d,
                }
          }
        />
      ))}
      {/* moon: full circle masked by an offset circle for the crescent */}
      <motion.g
        animate={reduced ? undefined : { opacity: [0.92, 1, 0.92] }}
        transition={
          reduced ? undefined : { duration: 5, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        <circle cx="120" cy="100" r="36" fill="#f1f5f9" />
        <circle cx="134" cy="92" r="32" fill="rgba(15,23,42,0.65)" />
      </motion.g>
    </svg>
  );
}

function CloudShape({
  x,
  y,
  scale,
  fill,
}: {
  x: number;
  y: number;
  scale: number;
  fill: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="20" cy="22" rx="22" ry="14" fill={fill} />
      <ellipse cx="40" cy="14" rx="22" ry="16" fill={fill} />
      <ellipse cx="58" cy="22" rx="20" ry="13" fill={fill} />
      <ellipse cx="40" cy="28" rx="34" ry="10" fill={fill} />
    </g>
  );
}

function CloudsScene({
  reduced,
  withSun,
  withMoon,
  density,
}: {
  reduced: boolean;
  withSun?: boolean;
  withMoon?: boolean;
  density: 'low' | 'med' | 'high';
}) {
  const lightFill = 'rgba(255,255,255,0.95)';
  const darkFill = 'rgba(226,232,240,0.85)';
  const fill = density === 'high' ? darkFill : lightFill;

  const cloudSpecs =
    density === 'low'
      ? [{ x: 120, y: 80, s: 1.0 }]
      : density === 'med'
        ? [
            { x: 80, y: 60, s: 0.9 },
            { x: 130, y: 90, s: 1.05 },
          ]
        : [
            { x: 30, y: 50, s: 0.85 },
            { x: 110, y: 70, s: 1.1 },
            { x: 60, y: 110, s: 0.75 },
            { x: 150, y: 130, s: 0.8 },
          ];

  return (
    <svg viewBox="0 0 240 200" className="h-full w-full">
      {withSun ? (
        <g>
          <defs>
            <radialGradient id="hero-sun-body">
              <stop offset="0%" stopColor="#fef9c3" />
              <stop offset="55%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#f59e0b" />
            </radialGradient>
          </defs>
          <circle cx="78" cy="68" r="60" fill="rgba(253,224,71,0.35)" />
          <circle cx="78" cy="68" r="28" fill="url(#hero-sun-body)" />
        </g>
      ) : null}
      {withMoon ? (
        <g>
          <circle cx="78" cy="68" r="60" fill="rgba(255,255,255,0.3)" />
          <g>
            <circle cx="78" cy="68" r="28" fill="#f1f5f9" />
            <circle cx="90" cy="62" r="24" fill="rgba(15,23,42,0.65)" />
          </g>
        </g>
      ) : null}
      {cloudSpecs.map((c, i) => (
        <motion.g
          key={i}
          animate={reduced ? undefined : { x: [-6, 6, -6] }}
          transition={
            reduced
              ? undefined
              : {
                  duration: 9 + i * 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: -i * 1.5,
                }
          }
        >
          <CloudShape x={c.x} y={c.y} scale={c.s} fill={fill} />
        </motion.g>
      ))}
    </svg>
  );
}

function RainScene({ reduced }: { reduced: boolean }) {
  const drops = Array.from({ length: 12 });
  return (
    <svg viewBox="0 0 240 200" className="h-full w-full">
      {/* main cloud */}
      <g>
        <CloudShape x={60} y={48} scale={1.4} fill="rgba(226,232,240,0.92)" />
      </g>
      {/* falling drops */}
      {drops.map((_, i) => {
        const x = 70 + (i * 12) % 130;
        const delay = (i * 0.18) % 1.4;
        return (
          <motion.line
            key={i}
            x1={x}
            y1={120}
            x2={x - 3}
            y2={140}
            stroke="rgba(147,197,253,0.95)"
            strokeWidth="2.4"
            strokeLinecap="round"
            animate={
              reduced
                ? undefined
                : { y: [0, 40, 60], opacity: [0, 1, 0] }
            }
            transition={
              reduced
                ? undefined
                : {
                    duration: 1.05,
                    repeat: Infinity,
                    delay,
                    ease: 'easeIn',
                  }
            }
          />
        );
      })}
    </svg>
  );
}

function SnowScene({ reduced }: { reduced: boolean }) {
  const flakes = Array.from({ length: 12 });
  return (
    <svg viewBox="0 0 240 200" className="h-full w-full">
      <g>
        <CloudShape x={60} y={48} scale={1.4} fill="rgba(241,245,249,0.95)" />
      </g>
      {flakes.map((_, i) => {
        const x = 70 + (i * 12) % 130;
        const delay = (i * 0.32) % 3.6;
        return (
          <motion.circle
            key={i}
            cx={x}
            cy={130}
            r="2.4"
            fill="white"
            animate={
              reduced
                ? undefined
                : {
                    cy: [120, 165],
                    cx: [x, x + 6, x - 6, x],
                    opacity: [0, 1, 1, 0],
                  }
            }
            transition={
              reduced
                ? undefined
                : { duration: 4, repeat: Infinity, delay, ease: 'easeInOut' }
            }
          />
        );
      })}
    </svg>
  );
}

function ThunderScene({ reduced }: { reduced: boolean }) {
  return (
    <svg viewBox="0 0 240 200" className="h-full w-full">
      <g>
        <CloudShape x={60} y={48} scale={1.4} fill="rgba(148,163,184,0.95)" />
      </g>
      <motion.path
        d="M 130 116 L 116 146 L 132 146 L 118 178 L 142 142 L 126 142 Z"
        fill="#facc15"
        stroke="#fbbf24"
        strokeWidth="1"
        animate={
          reduced
            ? undefined
            : { opacity: [0, 0, 1, 0, 1, 0, 0] }
        }
        transition={
          reduced
            ? undefined
            : {
                duration: 4,
                repeat: Infinity,
                times: [0, 0.6, 0.65, 0.7, 0.78, 0.85, 1],
                ease: 'linear',
              }
        }
        style={{
          filter: 'drop-shadow(0 0 12px rgba(253,224,71,0.7))',
        }}
      />
    </svg>
  );
}

function FogScene({ reduced }: { reduced: boolean }) {
  const bands = [
    { y: 70, w: 140 },
    { y: 100, w: 180 },
    { y: 130, w: 130 },
  ];
  return (
    <svg viewBox="0 0 240 200" className="h-full w-full">
      {bands.map((b, i) => (
        <motion.rect
          key={i}
          x={(240 - b.w) / 2}
          y={b.y}
          width={b.w}
          height={10}
          rx="5"
          fill="rgba(226,232,240,0.7)"
          animate={
            reduced ? undefined : { x: [(240 - b.w) / 2 - 8, (240 - b.w) / 2 + 8, (240 - b.w) / 2 - 8] }
          }
          transition={
            reduced
              ? undefined
              : {
                  duration: 7 + i,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: -i * 1.5,
                }
          }
        />
      ))}
    </svg>
  );
}

// ── public ────────────────────────────────────────────────────────────────

function pickScene(code: number, isDay: boolean, reduced: boolean) {
  if (code === 0) {
    return isDay ? <SunScene reduced={reduced} /> : <MoonScene reduced={reduced} />;
  }
  if (code === 1 || code === 2) {
    return (
      <CloudsScene
        reduced={reduced}
        withSun={isDay}
        withMoon={!isDay}
        density="low"
      />
    );
  }
  if (code === 3) {
    return <CloudsScene reduced={reduced} density="high" />;
  }
  if (code === 45 || code === 48) {
    return <FogScene reduced={reduced} />;
  }
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82)
  ) {
    return <RainScene reduced={reduced} />;
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return <SnowScene reduced={reduced} />;
  }
  if (code >= 95) return <ThunderScene reduced={reduced} />;
  return <CloudsScene reduced={reduced} density="med" />;
}

export function HeroScene({ code, isDay }: Props) {
  const reduced = useReducedMotion();
  return (
    <div
      className="mx-auto w-full max-w-[260px] sm:max-w-[300px]"
      style={{ aspectRatio: '6 / 5' }}
      aria-hidden
    >
      {pickScene(code, isDay, reduced)}
    </div>
  );
}
