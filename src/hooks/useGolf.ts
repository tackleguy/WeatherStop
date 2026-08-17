import { useEffect, useState } from 'react';
import {
  fetchGolfCourses,
  fetchGolfEnsemble,
  fetchGolfHoles,
  type GolfCourseSummary,
  type GolfEnsemble,
  type GolfHole,
} from '../lib/golf';

export function useGolfCourses(lat: number | null, lon: number | null) {
  const [courses, setCourses] = useState<GolfCourseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (lat == null || lon == null) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetchGolfCourses(lat, lon, { signal: ac.signal })
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
  }, [lat, lon, attempt]);

  return {
    courses,
    loading,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function useGolfHoles(
  lat: number | null,
  lon: number | null,
  bbox?: [number, number, number, number],
) {
  const [holes, setHoles] = useState<GolfHole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const bboxKey = bbox?.join(',') ?? '';

  useEffect(() => {
    if (lat == null || lon == null) return;
    const ac = new AbortController();
    setHoles([]);
    setLoading(true);
    setError(null);
    const bounds = bboxKey
      ? (bboxKey.split(',').map(Number) as [number, number, number, number])
      : undefined;
    fetchGolfHoles(lat, lon, { bbox: bounds, signal: ac.signal })
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
  }, [lat, lon, bboxKey, attempt]);

  return {
    holes,
    loading,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
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
