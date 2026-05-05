import { useCallback, useState } from 'react';

export type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

export interface GeoCoords {
  latitude: number;
  longitude: number;
}

export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback((): Promise<GeoCoords | null> => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return Promise.resolve(null);
    }
    setStatus('requesting');
    setError(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setCoords(next);
          setStatus('granted');
          resolve(next);
        },
        (err) => {
          setStatus('denied');
          setError(err.message);
          resolve(null);
        },
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
      );
    });
  }, []);

  return { status, coords, error, request };
}
