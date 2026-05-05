import { useMemo } from 'react';

const COUNT = 50;

interface Drop {
  left: number;
  delay: number;
  duration: number;
  length: number;
  opacity: number;
}

export function RainParticles() {
  const drops = useMemo<Drop[]>(
    () =>
      Array.from({ length: COUNT }, () => ({
        left: Math.random() * 100,
        delay: -Math.random() * 1.4,
        duration: 0.7 + Math.random() * 0.6,
        length: 14 + Math.random() * 14,
        opacity: 0.2 + Math.random() * 0.25,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-[6] overflow-hidden">
      {drops.map((d, i) => (
        <span
          key={i}
          className="absolute block bg-gradient-to-b from-white/0 via-white/70 to-white/0"
          style={{
            left: `${d.left}%`,
            top: '-10%',
            width: 1.4,
            height: d.length,
            opacity: d.opacity,
            transform: 'rotate(14deg)',
            animation: `rainfall ${d.duration}s linear ${d.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
