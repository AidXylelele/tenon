import * as React from "react";

const MOBILE_BREAKPOINT = 1024;
const WIDEST_MOBILE = MOBILE_BREAKPOINT - 1;
const QUERY = `(max-width: ${String(WIDEST_MOBILE)}px)`;

function subscribe(listener: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", listener);
  return () => {
    query.removeEventListener("change", listener);
  };
}

function isMobileNow(): boolean {
  return window.matchMedia(QUERY).matches;
}

function isMobileOnServer(): boolean {
  return false;
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, isMobileNow, isMobileOnServer);
}
