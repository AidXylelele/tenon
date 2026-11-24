"use client";

import { useSyncExternalStore } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip";
import { relativeText, utcText } from "./format";

const clock = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});
const clockWithSeconds = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const dayAndMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});
const dayMonthAndYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DAY_MS = 86_400_000;

function dayOf(at: number): number {
  const date = new Date(at);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

export function absoluteText(at: number, now: number, seconds = false): string {
  const shownClock = seconds ? clockWithSeconds : clock;
  const time = shownClock.format(at);
  const days = Math.round((dayOf(now) - dayOf(at)) / DAY_MS);

  if (days === 0) return `Today ${time}`;

  if (days === 1) return `Yesterday ${time}`;

  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  const date = sameYear ? dayAndMonth.format(at) : dayMonthAndYear.format(at);
  return `${date} ${time}`;
}

function subscribe(): () => void {
  return () => undefined;
}

function nowOnClient(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

function nowOnServer(): null {
  return null;
}

export function AbsoluteTime({
  value,
  seconds = false,
}: {
  readonly value: string | null;
  readonly seconds?: boolean;
}) {
  const now = useSyncExternalStore(subscribe, nowOnClient, nowOnServer);

  if (value === null) return <span className="text-muted-foreground">—</span>;

  if (now === null)
    return (
      <time dateTime={value} className="whitespace-nowrap">
        {utcText(value)}
      </time>
    );

  const at = new Date(value).getTime();
  const shown = absoluteText(at, now, seconds);
  const ago = relativeText(Math.min(at, now), now);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={value} className="whitespace-nowrap tabular-nums">
          {shown}
        </time>
      </TooltipTrigger>
      <TooltipContent>{ago}</TooltipContent>
    </Tooltip>
  );
}
