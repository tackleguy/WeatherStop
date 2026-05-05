import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from 'lucide-react';

interface Props {
  code: number;
  isDay: boolean | number;
  size?: number;
  className?: string;
}

const stroke = 1.5;

export function WeatherIcon({
  code,
  isDay,
  size = 32,
  className = '',
}: Props) {
  const day = typeof isDay === 'boolean' ? isDay : isDay !== 0;

  if (code === 0) {
    return day ? (
      <Sun
        size={size}
        strokeWidth={stroke}
        className={`${className} text-yellow-300`}
        style={{ filter: 'drop-shadow(0 0 8px rgba(253,224,71,0.4))' }}
      />
    ) : (
      <Moon
        size={size}
        strokeWidth={stroke}
        className={`${className} text-slate-100`}
        style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.3))' }}
      />
    );
  }
  if (code === 1 || code === 2) {
    return day ? (
      <CloudSun
        size={size}
        strokeWidth={stroke}
        className={`${className} text-white`}
      />
    ) : (
      <CloudMoon
        size={size}
        strokeWidth={stroke}
        className={`${className} text-slate-200`}
      />
    );
  }
  if (code === 3) {
    return (
      <Cloud
        size={size}
        strokeWidth={stroke}
        className={`${className} text-slate-300`}
      />
    );
  }
  if (code === 45 || code === 48) {
    return (
      <CloudFog
        size={size}
        strokeWidth={stroke}
        className={`${className} text-slate-300`}
      />
    );
  }
  if (code >= 51 && code <= 57) {
    return (
      <CloudDrizzle
        size={size}
        strokeWidth={stroke}
        className={`${className} text-blue-300`}
      />
    );
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return (
      <CloudRain
        size={size}
        strokeWidth={stroke}
        className={`${className} text-blue-300`}
      />
    );
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return (
      <CloudSnow
        size={size}
        strokeWidth={stroke}
        className={`${className} text-white`}
      />
    );
  }
  if (code >= 95) {
    return (
      <CloudLightning
        size={size}
        strokeWidth={stroke}
        className={`${className} text-yellow-300`}
      />
    );
  }
  return <Cloud size={size} strokeWidth={stroke} className={className} />;
}
