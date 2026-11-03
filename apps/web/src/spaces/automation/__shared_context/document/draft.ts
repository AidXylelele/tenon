import type { JsonObject } from '@/libs/data-access/types';
import { isObject } from './json';

// The `document` header of a draft and the version a new edit proposes.

export const DSL_VERSION = '1.0.3';

// The API takes documents up to 1 MiB (002 spec, Assumptions).
export const MAX_DOCUMENT_BYTES = 1024 * 1024;

export interface Header {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly title: string;
  readonly summary: string;
}

export function newDraft(): JsonObject {
  return {
    document: {
      dsl: DSL_VERSION,
      namespace: 'default',
      name: 'my-workflow',
      version: '1.0.0',
    },
    do: [{ greet: { set: { message: 'Hello' } } }],
  };
}

export function headerOf(draft: JsonObject): Header {
  const document = isObject(draft.document) ? draft.document : {};
  const text = (key: string) => {
    const value = document[key];
    return typeof value === 'string' ? value : '';
  };
  return {
    namespace: text('namespace'),
    name: text('name'),
    version: text('version'),
    title: text('title'),
    summary: text('summary'),
  };
}

// A draft of an existing version: the same document with the next version proposed.
export function draftFrom(document: JsonObject): JsonObject {
  const header = isObject(document.document) ? document.document : {};
  const version = typeof header.version === 'string' ? header.version : '1.0.0';
  return {
    ...document,
    document: { ...header, version: nextVersion(version) },
  };
}

// The next patch of a semantic version: `1.2.3` → `1.2.4`, `1.2.3-beta` → `1.2.4`.
export function nextVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);

  if (match === null) return '1.0.0';

  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

export function sizeOf(draft: JsonObject): number {
  return new TextEncoder().encode(JSON.stringify(draft)).length;
}
