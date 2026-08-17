import { useEffect, useState } from 'react';
import {
  fetchGolfCourses,
  fetchGolfEnsemble,
  fetchGolfHoles,
  type GolfCourseSummary,
  type GolfEnsemble,
  type GolfHole,
} from '../lib/golf';

export function useGolfCourses(
  lat: number | null,
  lon: number | null,
  q = '',
) {
  const [courses, setCourses] = useState<GolfCourseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lat == null || lon == null) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetchGolfCourses(lat, lon, { q: q || undefined, signal: ac.signal })
      .then(setCourses)
      .catch((err) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load courses');
        setCourses([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [lat, lon, q]);

  return { courses, loading, error };
}

export function useGolfHoles(lat: number | null, lon: number | null) {
  const [holes, setHoles] = useState<GolfHole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lat == null || lon == null) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetchGolfHoles(lat, lon, { signal: ac.signal })
      .then(setHoles)
      .catch((err) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load holes');
        setHoles([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [lat, lon]);

  return { holes, loading, error };
}

export function useGolfEnsemble(
  lat: number | null,
  lon: number | null,
  holes: GolfHole[],
  hour: number,
) {
  const [data, setData] = useState<GolfEnsemble | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const holeKey = holes
    .map((h) => `${h.number}:${h.yards}:${h.bearingDeg}`)
    .join('|');

  useEffect(() => {
    if (lat == null || lon == null) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetchGolfEnsemble(
      lat,
      lon,
      holes.map((h) => ({
        number: h.number,
        yards: h.yards,
        bearingDeg: h.bearingDeg,
        par: h.par,
        name: h.name,
      })),
      hour,
      ac.signal,
    )
      .then(setData)
      .catch((err) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Ensemble failed');
        setData(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
    // holeKey captures hole geometry changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, hour, holeKey]);

  return { data, loading, error };
}
