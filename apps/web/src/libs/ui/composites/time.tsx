"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { durationText, relativeText, utcText } from "./format";

const TICK_MS = 15_000;
const MINUTE_MS = 60_000;

const clock = {
  listeners: new Set<() => void>(),
  now: Date.now(),
  timer: undefined as ReturnType<typeof setInterval> | undefined,
  subscribe: (listener: () => void) => {
    clock.now = Date.now();
    clock.listeners.add(listener);
    clock.timer ??= setInterval(() => {
      clock.now = Date.now();
      clock.listeners.forEach((each) => {
        each();
      });
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
}

export function Time({ value }: TimeProps) {
  const coarse = useSyncExternalStore(
    clock.subscribe,
    nowOnClient,
    nowOnServer,
  );
  const at = value === null ? null : new Date(value);
  const recent =
    coarse !== null &&
    at !== null &&
    Math.abs(coarse - at.getTime()) < MINUTE_MS;
  const fine = useSecondTicks(recent);
  const now = recent ? (fine ?? coarse) : coarse;

  if (value === null || at === null)
    return <span className="text-muted-foreground">—</span>;

  if (now === null)
    return (
      <time dateTime={value} className="whitespace-nowrap">
        {utcText(value)}
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

export function Countdown({ to }: CountdownProps) {
  const now = useSecondTicks(true);

  if (now === null) return <span className="text-muted-foreground">…</span>;

  const left = new Date(to).getTime() - now;

  if (left <= 0) return <span className="whitespace-nowrap">now</span>;

  const seconds = Math.ceil(left / 1000);
  const text = seconds < 60 ? `${String(seconds)} s` : durationText(left);
  return <span className="whitespace-nowrap tabular-nums">in {text}</span>;
}

function useSecondTicks(running: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      setNow(Date.now());
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [running]);

  return now;
}
