'use client';

import { useSyncExternalStore } from 'react';

// How often live pages refresh, chosen by the viewer and kept in this browser (research R14).
// Nothing is faster than Grafana's default `min_refresh_interval` of 5 s.
export type RefreshChoice =
  'auto' | 'off' | '5000' | '10000' | '30000' | '60000' | '300000';

export const REFRESH_CHOICES: readonly RefreshChoice[] = [
  'auto',
  'off',
  '5000',
  '10000',
  '30000',
  '60000',
  '300000',
];

const KEY = 'console.refresh';
const CHANGED = 'console:refresh-changed';

// The choice while storage is blocked, for as long as the page stays.
let remembered: RefreshChoice = 'auto';

export function useRefreshChoice(): RefreshChoice {
  return useSyncExternalStore(subscribe, storedChoice, defaultChoice);
}

export function chooseRefresh(choice: RefreshChoice): void {
  remembered = choice;

  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // Storage can be blocked; the choice then lasts until the page is left.
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('storage', listener);
  window.addEventListener(CHANGED, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(CHANGED, listener);
  };
}

function storedChoice(): RefreshChoice {
  try {
    const stored = window.localStorage.getItem(KEY);
    const known = REFRESH_CHOICES.find((choice) => choice === stored);
    return known ?? remembered;
  } catch {
    return remembered;
  }
}

function defaultChoice(): RefreshChoice {
  return 'auto';
}
