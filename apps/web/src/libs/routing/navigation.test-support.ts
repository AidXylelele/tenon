import { useMemo, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const replace = window.history.replaceState.bind(window.history);

window.history.replaceState = (data, unused, url) => {
  replace(data, unused, url);
  listeners.forEach((listener) => {
    listener();
  });
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function searchNow(): string {
  return window.location.search;
}

function pathnameNow(): string {
  return window.location.pathname;
}

export function useSearchParams(): URLSearchParams {
  const search = useSyncExternalStore(subscribe, searchNow);
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, pathnameNow);
}

export function visit(href: string): void {
  window.history.replaceState(null, "", href);
}
