// Global keyboard shortcuts. Call once from <App>. Each binding is a
// pure callback handed in at mount; the hook handles preventDefault and
// ignores keypresses inside form inputs.

import { useEffect, useRef } from 'react';

export interface ShortcutMap {
  /** Move to the previous saved city (left arrow / h). */
  prevCity?: () => void;
  /** Move to the next saved city (right arrow / l). */
  nextCity?: () => void;
  /** Open the city search modal (/ or s). */
  openSearch?: () => void;
  /** Open the settings sheet (,). */
  openSettings?: () => void;
  /** Refresh the current city (r). */
  refresh?: () => void;
  /** Toggle the compare modal (c). */
  toggleCompare?: () => void;
  /** Close any open modal (Escape). */
  closeModals?: () => void;
}

const TYPING_NODES = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (TYPING_NODES.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(map: ShortcutMap) {
  // Pin the latest callbacks so consumers don't need to memoize.
  const ref = useRef(map);
  ref.current = map;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const m = ref.current;
      if (e.metaKey || e.ctrlKey) return;

      if (e.key === 'Escape') {
        m.closeModals?.();
        return;
      }
      if (isTyping(e.target)) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'h':
        case 'H':
          if (m.prevCity) {
            m.prevCity();
            e.preventDefault();
          }
          break;
        case 'ArrowRight':
        case 'l':
        case 'L':
          if (m.nextCity) {
            m.nextCity();
            e.preventDefault();
          }
          break;
        case '/':
        case 's':
        case 'S':
          if (m.openSearch) {
            m.openSearch();
            e.preventDefault();
          }
          break;
        case ',':
          if (m.openSettings) {
            m.openSettings();
            e.preventDefault();
          }
          break;
        case 'r':
        case 'R':
          if (m.refresh) {
            m.refresh();
            e.preventDefault();
          }
          break;
        case 'c':
        case 'C':
          if (m.toggleCompare) {
            m.toggleCompare();
            e.preventDefault();
          }
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
