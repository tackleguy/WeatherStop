// OpenFreeMap basemap catalog. All styles share the same vector tiles so
// swapping only reloads paint rules — overlays remount on `style.load`.

export type MapStyleId = 'dark' | 'liberty' | 'positron' | 'bright';

export interface MapStyleOption {
  id: MapStyleId;
  label: string;
  url: string;
  /** Suggested app theme when this basemap is picked. */
  themeHint?: 'dark' | 'light';
}

export const MAP_STYLES: MapStyleOption[] = [
  {
    id: 'dark',
    label: 'Dark',
    url: 'https://tiles.openfreemap.org/styles/dark',
    themeHint: 'dark',
  },
  {
    id: 'liberty',
    label: 'Streets',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    themeHint: 'light',
  },
  {
    id: 'positron',
    label: 'Light',
    url: 'https://tiles.openfreemap.org/styles/positron',
    themeHint: 'light',
  },
  {
    id: 'bright',
    label: 'Bright',
    url: 'https://tiles.openfreemap.org/styles/bright',
    themeHint: 'light',
  },
];

export const DEFAULT_MAP_STYLE: MapStyleId = 'dark';

export function mapStyleUrl(id: MapStyleId): string {
  return MAP_STYLES.find((s) => s.id === id)?.url ?? MAP_STYLES[0].url;
}
