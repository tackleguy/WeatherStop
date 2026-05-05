import { motion, type Transition } from 'framer-motion';
import { useEffect, useState } from 'react';
import { WeatherIcon } from '../lib/weatherIcons';

interface Props {
  code: number;
  isDay: boolean;
}

interface SceneSpec {
  glow: string;
  animate: Record<string, number[]> | Record<string, number>;
  transition: Transition;
  iconSize: number;
}

function specFor(code: number, isDay: boolean): SceneSpec {
  // Clear sun: gentle pulse + warm halo
  if (code === 0 && isDay) {
    return {
      glow: 'rgba(253,224,71,0.55)',
      animate: { scale: [1, 1.05, 1] },
      transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
      iconSize: 104,
    };
  }
  // Clear moon: soft brightness pulse
  if (code === 0 && !isDay) {
    return {
      glow: 'rgba(255,255,255,0.35)',
      animate: { opacity: [0.85, 1, 0.85] },
      transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
      iconSize: 100,
    };
  }
  // Mostly clear / partly cloudy / cloudy: lateral drift
  if (code === 1 || code === 2 || code === 3) {
    return {
      glow: isDay ? 'rgba(255,255,255,0.3)' : 'rgba(148,163,184,0.35)',
      animate: { x: [-6, 6, -6] },
      transition: { duration: 9, repeat: Infinity, ease: 'easeInOut' },
      iconSize: 100,
    };
  }
  // Fog: drift slower with reduced opacity
  if (code === 45 || code === 48) {
    return {
      glow: 'rgba(203,213,225,0.4)',
      animate: { x: [-4, 4, -4], opacity: [0.7, 1, 0.7] },
      transition: { duration: 7, repeat: Infinity, ease: 'easeInOut' },
      iconSize: 100,
    };
  }
  // Drizzle / rain / showers: gentle bounce
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82)
  ) {
    return {
      glow: 'rgba(96,165,250,0.45)',
      animate: { y: [-3, 3, -3] },
      transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
      iconSize: 100,
    };
  }
  // Snow: soft wobble
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return {
      glow: 'rgba(255,255,255,0.45)',
      animate: { rotate: [-3, 3, -3] },
      transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
      iconSize: 100,
    };
  }
  // Thunder / hail: pulse with high contrast
  if (code >= 95) {
    return {
      glow: 'rgba(253,224,71,0.6)',
      animate: { opacity: [1, 0.5, 1, 1, 0.5, 1] },
      transition: { duration: 3.5, repeat: Infinity, ease: 'linear' },
      iconSize: 100,
    };
  }
  return {
    glow: 'rgba(255,255,255,0.3)',
    animate: { y: [-2, 2, -2] },
    transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
    iconSize: 100,
  };
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

export function HeroScene({ code, isDay }: Props) {
  const reduced = useReducedMotion();
  const spec = specFor(code, isDay);

  return (
    <div className="relative mx-auto flex h-32 w-full items-center justify-center pt-2">
      {/* halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-32 w-32 rounded-full blur-3xl"
        style={{ background: spec.glow }}
      />
      <motion.div
        animate={reduced ? undefined : spec.animate}
        transition={reduced ? undefined : spec.transition}
        className="relative"
        style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.25))' }}
      >
        <WeatherIcon code={code} isDay={isDay} size={spec.iconSize} />
      </motion.div>
    </div>
  );
}
