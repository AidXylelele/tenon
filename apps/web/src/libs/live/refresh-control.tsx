'use client';

import { cn } from 'cn';
import { ChevronDownIcon, RefreshCwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';
import { Button } from '@/libs/ui/components/button';
import { ButtonGroup } from '@/libs/ui/components/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/libs/ui/components/dropdown-menu';
import {
  chooseRefresh,
  REFRESH_CHOICES,
  type RefreshChoice,
  useRefreshChoice,
} from './refresh-preference';

// What a page shows: something still in flight, a list that new items can join, or nothing that
// changes by itself.
export type Activity = 'in-flight' | 'open' | 'ended';

const IN_FLIGHT_MS = 5_000;
const OPEN_MS = 60_000;

interface RefreshControlProps {
  readonly activity: Activity;
  // When the server rendered what is shown (ms since the epoch); each refresh brings a new one.
  readonly renderedAt: number;
  readonly className?: string;
}

// The page's one refresh control, after Grafana's (research R14): refresh now, an interval
// (Auto by default), and how fresh the page is. Auto refreshes every 5 s while something is in
// flight and every minute otherwise; a hidden page waits, and refreshes on return when a refresh
// fell due. The router keeps client state across a refresh, so open panels and typed text stay.
export function RefreshControl({
  activity,
  renderedAt,
  className,
}: RefreshControlProps) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [askedAt, setAskedAt] = useState(0);
  const choice = useRefreshChoice();
  const visible = useSyncExternalStore(
    subscribeToVisibility,
    isVisible,
    isVisibleOnServer,
  );
  const now = useNow(visible);
  const intervalMs = intervalOf(choice, activity);

  // The next refresh falls due an interval after the newer of the last render and the last
  // request, so a refresh that failed is not asked again at once; one in flight is never stacked.
  useEffect(() => {
    if (intervalMs === null || !visible || refreshing) return;

    const last = Math.max(renderedAt, askedAt);
    const wait = Math.max(0, last + intervalMs - Date.now());
    const timer = setTimeout(() => {
      setAskedAt(Date.now());
      startRefresh(() => router.refresh());
    }, wait);
    return () => clearTimeout(timer);
  }, [intervalMs, visible, refreshing, renderedAt, askedAt, router]);

  const refreshNow = () => {
    setAskedAt(Date.now());
    startRefresh(() => router.refresh());
  };
  const live = activity === 'in-flight' && intervalMs !== null && visible;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            live ? 'bg-emerald-500' : 'bg-muted-foreground/40',
            live && refreshing && 'animate-pulse',
          )}
        />
        <span suppressHydrationWarning>
          {freshnessOf(now, renderedAt, visible, intervalMs)}
        </span>
      </span>
      <ButtonGroup>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Refresh now"
          title="Refresh now"
          disabled={refreshing}
          onClick={refreshNow}
        >
          <RefreshCwIcon className={cn(refreshing && 'animate-spin')} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Refresh interval: ${labelOf(choice)}`}
              className="gap-1 px-2 tabular-nums"
            >
              {labelOf(choice)}
              <ChevronDownIcon className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Refresh this page</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={choice}
              onValueChange={(value) => chooseRefresh(value as RefreshChoice)}
            >
              {REFRESH_CHOICES.map((each) => (
                <DropdownMenuRadioItem key={each} value={each}>
                  <span className="flex flex-col">
                    <span>{choiceLabelOf(each)}</span>
                    {each === 'auto' && (
                      <span className="text-xs text-muted-foreground">
                        Every 5 s while something runs, otherwise every minute
                      </span>
                    )}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    </div>
  );
}

// The interval in force, or null when nothing refreshes by itself.
export function intervalOf(
  choice: RefreshChoice,
  activity: Activity,
): number | null {
  if (choice === 'off') return null;

  if (choice !== 'auto') return Number(choice);

  if (activity === 'in-flight') return IN_FLIGHT_MS;

  if (activity === 'open') return OPEN_MS;

  return null;
}

function freshnessOf(
  now: number,
  renderedAt: number,
  visible: boolean,
  intervalMs: number | null,
): string {
  if (!visible && intervalMs !== null) return 'Paused while hidden';

  const seconds = Math.max(0, Math.round((now - renderedAt) / 1000));
  const age = seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min`;
  return `Updated ${age} ago`;
}

function labelOf(choice: RefreshChoice): string {
  if (choice === 'auto') return 'Auto';

  if (choice === 'off') return 'Off';

  return durationOf(Number(choice));
}

function choiceLabelOf(choice: RefreshChoice): string {
  if (choice === 'auto' || choice === 'off') return labelOf(choice);

  return `Every ${durationOf(Number(choice))}`;
}

function durationOf(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  return seconds < 60 ? `${seconds} s` : `${seconds / 60} min`;
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

// The current time, ticking every second while the page is visible.
function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!ticking) return;

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  return now;
}
