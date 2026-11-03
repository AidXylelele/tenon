'use client';

import { cn } from 'cn';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';

interface LiveRefreshProps {
  // Whether what the page shows is still in flight; the refresh stops once it is not.
  readonly active: boolean;
  // When the server rendered what is shown (ms since the epoch); each refresh brings a new one.
  readonly renderedAt: number;
  readonly intervalMs?: number;
  readonly className?: string;
}

// Re-renders the current route on an interval while something it shows is in flight, and
// pauses while the page is hidden (research R1, R7). The router keeps client state across a
// refresh, so open panels and typed text stay as they are.
export function LiveRefresh({
  active,
  renderedAt,
  intervalMs = 2000,
  className,
}: LiveRefreshProps) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const visible = useSyncExternalStore(
    subscribeToVisibility,
    isVisible,
    isVisibleOnServer,
  );
  const now = useNow(active);

  // A tick that finds the previous refresh still on its way skips, so a slow platform never
  // gets a queue of refreshes.
  const inFlight = useRef(refreshing);

  useEffect(() => {
    inFlight.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (!active || !visible) return;

    const timer = setInterval(() => {
      if (inFlight.current) return;

      startRefresh(() => router.refresh());
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, visible, intervalMs, router]);

  if (!active) return null;

  const seconds = Math.max(0, Math.round((now - renderedAt) / 1000));
  const label = visible
    ? `Live · updated ${seconds} s ago`
    : 'Live · paused while hidden';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums',
        className,
      )}
    >
      <span className="relative flex size-2" aria-hidden>
        <span
          className={cn(
            'absolute inline-flex size-full rounded-full bg-emerald-500 opacity-75',
            refreshing && 'animate-ping',
          )}
        />
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            visible ? 'bg-emerald-500' : 'bg-muted-foreground',
          )}
        />
      </span>
      <span suppressHydrationWarning>{label}</span>
    </span>
  );
}

function subscribeToVisibility(listener: () => void): () => void {
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
}

function isVisible(): boolean {
  return document.visibilityState === 'visible';
}

function isVisibleOnServer(): boolean {
  return true;
}

// The current time, ticking every second while the view is live.
function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!ticking) return;

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  return now;
}
