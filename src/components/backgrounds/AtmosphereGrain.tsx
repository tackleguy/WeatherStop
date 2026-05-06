// Subtle film-grain noise overlay. Sits between the gradient and the
// particle layers; fills in the "flat" feel of a single CSS gradient
// the way a photographer's grain film does to a clean digital sky.

export function AtmosphereGrain() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-[5] h-full w-full"
      style={{ opacity: 0.04, mixBlendMode: 'overlay' }}
    >
      <filter id="atmosphere-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves={2}
          stitchTiles="stitch"
        />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 1.6 0"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#atmosphere-grain)" />
    </svg>
  );
}
