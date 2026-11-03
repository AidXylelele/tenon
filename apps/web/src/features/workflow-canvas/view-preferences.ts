'use client';

import { useSyncExternalStore } from 'react';
import type { Direction } from './layout';

// How the viewer arranges a canvas (research R16): its direction, and which groups are closed,
// per workflow. Kept in this browser only: arranging the picture never edits the workflow.

const DIRECTION = 'canvas.direction';
const COLLAPSED = 'canvas.collapsed:';
const CHANGED = 'console:canvas-changed';
const NONE: ReadonlySet<string> = new Set();

// The value while storage is blocked, for as long as the page stays.
const remembered = new Map<string, string>();
// Parsed sets by their stored text, so a snapshot keeps its identity between reads.
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
  return read(DIRECTION) === 'right' ? 'right' : 'down';
}

function defaultDirection(): Direction {
  return 'down';
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
      ? value.filter((id): id is string => typeof id === 'string')
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
  remembered.set(key, value);

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked; the arrangement then lasts until the page is left.
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('storage', listener);
  window.addEventListener(CHANGED, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(CHANGED, listener);
  };
}
