'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

// Whether the system asks for dark colours, which the console follows (research R12).
export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribe, prefersDark, () => false);
}

function subscribe(listener: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

function prefersDark(): boolean {
  return window.matchMedia(QUERY).matches;
}
