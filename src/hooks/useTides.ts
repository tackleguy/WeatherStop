// Tide data hook for coastal cities. Returns null tides for non-coastal
// or no-station cities so the consumer can simply not render the card.

import { useEffect, useState } from 'react';
import {
  fetchTidePredictions,
  nearestTideStation,
  type TideEvent,
  type TideStation,
} from '../lib/noaaTides';
import type { City } from '../types';

interface State {
  station: TideStation | null;
  events: TideEvent[];
  loading: boolean;
  error?: string;
}

const REFRESH_MS = 30 * 60_000;

export function useTides(city: City | undefined): State {
  const [state, setState] = useState<State>(() => ({
    station: city ? nearestTideStation(city) : null,
    events: [],
    loading: false,
  }));

  useEffect(() => {
    const station = city ? nearestTideStation(city) : null;
    setState((s) => ({ ...s, station, events: [], error: undefined }));
    if (!city || !station) return;

    const ctrl = new AbortController();

    const load = async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const events = await fetchTidePredictions(station, ctrl.signal);
        setState({ station, events, loading: false });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState({
          station,
          events: [],
          loading: false,
          error: (err as Error).message ?? 'Tide fetch failed',
        });
      }
    };

    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(id);
    };
  }, [city?.id, city?.latitude, city?.longitude]);

  return state;
}
