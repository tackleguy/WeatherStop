// Composite reflectivity preset on the radar map.

import { useEffect } from 'react';
import { useRadarStore } from '../store/useRadarStore';
import { RadarView } from './RadarView';

export function CompositeView() {
  const setActiveProduct = useRadarStore((s) => s.setActiveProduct);

  useEffect(() => {
    setActiveProduct('composite');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <RadarView />;
}
