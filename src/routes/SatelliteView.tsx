// Satellite view = RadarView with the active product locked to satellite-ir
// (or satellite-vis if the user previously chose it). On mount we make sure
// the store has a satellite product selected; on unmount we restore the
// last radar product so flipping back to /radar feels continuous.

import { useEffect } from 'react';
import { useRadarStore } from '../store/useRadarStore';
import { RadarView } from './RadarView';

export function SatelliteView() {
  const setActiveProduct = useRadarStore((s) => s.setActiveProduct);
  const previousProduct = useRadarStore((s) => s.activeProduct);

  useEffect(() => {
    if (previousProduct !== 'satellite-ir' && previousProduct !== 'satellite-vis') {
      setActiveProduct('satellite-ir');
    }
    // We deliberately don't restore on unmount — the user expects the
    // selection to persist into /radar so they can A/B compare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <RadarView />;
}
