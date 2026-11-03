import * as React from 'react';

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(listener: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

function isMobileNow(): boolean {
  return window.matchMedia(QUERY).matches;
}

function isMobileOnServer(): boolean {
  return false;
}

// Whether the viewport is narrower than the sidebar's breakpoint, read from the media query
// as an external store (shadcn's hook set state in an effect, which the React rules refuse).
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, isMobileNow, isMobileOnServer);
}
