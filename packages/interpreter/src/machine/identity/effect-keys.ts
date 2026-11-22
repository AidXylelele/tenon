import type { Path } from "./paths.js";

export type EffectKey = PerformKey | SchemaKey | RetryKey | ItemKey;

export type ItemKey = EventKey | MessageKey;

export interface PerformKey {
  readonly kind: "perform";
  readonly at: Path;
}

export interface SchemaKey {
  readonly kind: "schema";
  readonly at: Path;
  readonly pointer: string;
}

export interface RetryKey {
  readonly kind: "retry";
  readonly at: Path;
}

interface EventKey {
  readonly kind: "event";
  readonly at: Path;
  readonly position: number;
}

interface MessageKey {
  readonly kind: "message";
  readonly at: Path;
  readonly position: number;
}

export function performKeyOf(path: Path): PerformKey {
  return { kind: "perform", at: path };
}

export function schemaKeyOf(path: Path, schemaPointer: string): SchemaKey {
  return { kind: "schema", at: path, pointer: schemaPointer };
}

export function retryKeyOf(next: Path): RetryKey {
  return { kind: "retry", at: next };
}

export function eventKeyOf(path: Path, position: number): ItemKey {
  return { kind: "event", at: path, position };
}

export function messageKeyOf(path: Path, position: number): ItemKey {
  return { kind: "message", at: path, position };
}
