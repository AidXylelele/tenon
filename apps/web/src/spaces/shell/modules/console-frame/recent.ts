"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";

export interface Visit {
  readonly label: string;
  readonly href: string;
}

const KEY = "console.recent";
const NOBODY = "";
const CHANGED = "console:recent-changed";
const KEPT = 5;

const Visits = z.array(z.object({ label: z.string(), href: z.string() }));

export function useRecent(userId: string | null): readonly Visit[] {
  const key = keyOf(userId);
  const stored = useSyncExternalStore(
    subscribe,
    () => storedText(key),
    nothingOnServer,
  );
  return visitsOf(stored);
}

export function remember(userId: string | null, visit: Visit): void {
  const key = keyOf(userId);

  if (key === NOBODY) return;

  const stored = storedText(key);
  const earlier = visitsOf(stored).filter((each) => each.href !== visit.href);
  const kept = [visit].concat(earlier).slice(0, KEPT);
  const text = JSON.stringify(kept);

  try {
    window.localStorage.setItem(key, text);
  } catch {
    return;
  }

  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGED, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGED, listener);
  };
}

function keyOf(userId: string | null): string {
  if (userId === null) return NOBODY;

  return `${KEY}.${userId}`;
}

function storedText(key: string): string {
  if (key === NOBODY) return "";

  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function nothingOnServer(): string {
  return "";
}

function visitsOf(text: string): readonly Visit[] {
  if (text === "") return [];

  try {
    const parsed: unknown = JSON.parse(text);
    const visits = Visits.safeParse(parsed);
    return visits.success ? visits.data : [];
  } catch {
    return [];
  }
}
