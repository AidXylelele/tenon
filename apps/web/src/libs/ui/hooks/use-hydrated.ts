import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => undefined;
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
