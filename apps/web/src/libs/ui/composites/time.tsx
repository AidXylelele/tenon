'use client';

import { useSyncExternalStore } from 'react';
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
  const exact = at.toLocaleString();
  const shown = now === null ? exact : relativeText(at.getTime(), now);

  return (
    <time dateTime={value} title={exact} className="whitespace-nowrap">
      {shown}
    </time>
  );
}

interface DurationProps {
  readonly from: string | null;
  readonly to: string | null;
}

// How long something took, or has taken so far while it runs.
export function Duration({ from, to }: DurationProps) {
  const now = useSyncExternalStore(clock.subscribe, nowOnClient, nowOnServer);

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
