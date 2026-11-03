'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { durationText, relativeText } from './format';

const TICK_MS = 15_000;

// One shared clock that ticks while any time is shown, so relative times stay true.
const clock = {
  listeners: new Set<() => void>(),
  now: Date.now(),
  timer: undefined as ReturnType<typeof setInterval> | undefined,
  subscribe(listener: () => void) {
    clock.listeners.add(listener);
    clock.timer ??= setInterval(() => {
      clock.now = Date.now();
      clock.listeners.forEach((each) => each());
    }, TICK_MS);
    return () => {
      clock.listeners.delete(listener);

      if (clock.listeners.size > 0 || clock.timer === undefined) return;

      clearInterval(clock.timer);
      clock.timer = undefined;
    };
  },
};

const nowOnClient = () => clock.now;
const nowOnServer = () => null;

interface TimeProps {
  readonly value: string | null;
  readonly empty?: string;
}

// A time as "3 min ago", with the exact local time on hover. It renders on the client, in the
// person's locale and time zone (research R8).
export function Time({ value, empty = '—' }: TimeProps) {
  const now = useSyncExternalStore(clock.subscribe, nowOnClient, nowOnServer);

  if (value === null)
    return <span className="text-muted-foreground">{empty}</span>;

  const at = new Date(value);

  // The server and the first client render agree on a time that needs no locale; the
  // person's own locale and zone take over once the page is live.
  if (now === null)
    return (
      <time dateTime={value} className="whitespace-nowrap">
        {`${value.slice(0, 16).replace('T', ' ')} UTC`}
      </time>
    );

  return (
    <time
      dateTime={value}
      title={at.toLocaleString()}
      className="whitespace-nowrap"
    >
      {relativeText(at.getTime(), now)}
    </time>
  );
}

interface DurationProps {
  readonly from: string | null;
  readonly to: string | null;
}

// How long something took, or has taken so far while it runs; a running one counts every
// second.
export function Duration({ from, to }: DurationProps) {
  const now = useSecondTicks(to === null && from !== null);

  if (from === null) return <span className="text-muted-foreground">—</span>;

  const end = to === null ? now : new Date(to).getTime();

  if (end === null) return <span className="text-muted-foreground">…</span>;

  const elapsed = end - new Date(from).getTime();
  return (
    <span className="whitespace-nowrap tabular-nums">
      {durationText(elapsed)}
    </span>
  );
}

interface CountdownProps {
  readonly to: string;
}

// How soon something is due, counted down each second: "in 4 s", "in 3 min 5 s".
export function Countdown({ to }: CountdownProps) {
  const now = useSecondTicks(true);

  if (now === null) return <span className="text-muted-foreground">…</span>;

  const left = new Date(to).getTime() - now;

  if (left <= 0) return <span className="whitespace-nowrap">now</span>;

  const seconds = Math.ceil(left / 1000);
  const text = seconds < 60 ? `${String(seconds)} s` : durationText(left);
  return <span className="whitespace-nowrap tabular-nums">in {text}</span>;
}

// The current time each second while `running`; null on the server and before hydration.
function useSecondTicks(running: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!running) return;

    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [running]);

  return now;
}
