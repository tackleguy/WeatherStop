// Reads bbox + zoom from the radar store. RadarMap is the writer; this
// hook just gives consumers a stable shape with a memoized bbox string.

import { useMemo } from 'react';
import { useRadarStore } from '../store/useRadarStore';

export function useViewport() {
  const bbox = useRadarStore((s) => s.bbox);
  const zoom = useRadarStore((s) => s.mapZoom);

  const bboxString = useMemo(
    () => (bbox ? bbox.join(',') : null),
    [bbox],
  );

  return { bbox, bboxString, zoom };
}
