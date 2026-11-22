"use client";

import { useSyncExternalStore } from "react";
import type { Direction } from "@/operations/workflow-graph";

const DIRECTION = "canvas.direction";
const COLLAPSED = "canvas.collapsed:";
const CHANGED = "console:canvas-changed";
const NONE: ReadonlySet<string> = new Set();

const remembered = new Map<string, string>();
const parsed = new Map<string, ReadonlySet<string>>();

export function useDirection(): Direction {
  return useSyncExternalStore(subscribe, storedDirection, defaultDirection);
}

export function chooseDirection(direction: Direction): void {
  store(DIRECTION, direction);
}

export function useCollapsed(scope: string): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => collapsedOf(scope),
    () => NONE,
  );
}

export function setCollapsed(scope: string, ids: Iterable<string>): void {
  const sorted = [...new Set(ids)].sort();
  store(`${COLLAPSED}${scope}`, JSON.stringify(sorted));
}

export function toggleCollapsed(scope: string, id: string): void {
  const next = new Set(collapsedOf(scope));

  if (next.has(id)) next.delete(id);
  else next.add(id);

  setCollapsed(scope, next);
}

function storedDirection(): Direction {
  return read(DIRECTION) === "right" ? "right" : "down";
}

function defaultDirection(): Direction {
  return "down";
}

function collapsedOf(scope: string): ReadonlySet<string> {
  const text = read(`${COLLAPSED}${scope}`);

  if (text === null) return NONE;

  const known = parsed.get(text);

  if (known !== undefined) return known;

  const ids = idsOf(text);
  parsed.set(text, ids);
  return ids;
}

function idsOf(text: string): ReadonlySet<string> {
  try {
    const value: unknown = JSON.parse(text);
    const ids = Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string")
      : [];
    return new Set(ids);
  } catch {
    return NONE;
  }
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? remembered.get(key) ?? null;
  } catch {
    return remembered.get(key) ?? null;
  }
}

function store(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    remembered.set(key, value);
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
