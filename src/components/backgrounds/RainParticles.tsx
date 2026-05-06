import { useMemo } from 'react';

const COUNT = 70;

interface Drop {
  left: number;
  delay: number;
  duration: number;
  length: number;
  opacity: number;
  width: number;
}

export function RainParticles() {
  const drops = useMemo<Drop[]>(
    () =>
      Array.from({ length: COUNT }, () => ({
        left: Math.random() * 100,
        delay: -Math.random() * 1.4,
        duration: 0.55 + Math.random() * 0.45,
        length: 14 + Math.random() * 18,
        opacity: 0.18 + Math.random() * 0.18,
        width: Math.random() < 0.7 ? 1.4 : 1.8,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-[6] overflow-hidden">
      {drops.map((d, i) => (
        <span
          key={i}
          className="absolute block bg-gradient-to-b from-white/0 via-white/95 to-white/0"
          style={{
            left: `${d.left}%`,
            top: '-10%',
            width: d.width,
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
