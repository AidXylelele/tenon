import { useSyncExternalStore } from 'react';

function subscribe(): () => void {
  return () => undefined;
}

// Whether the page runs in the browser after hydration: false on the server and while the
// server's markup is hydrated, true from then on, for parts the server cannot render the same.
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
