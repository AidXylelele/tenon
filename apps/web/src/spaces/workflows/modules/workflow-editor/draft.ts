import { isObject, type JsonObject } from '@/libs/document-text/json';

// A new draft, a draft of an existing version with the version a new edit proposes, and its
// size.

export const DSL_VERSION = '1.0.3';

// The API takes documents up to 1 MiB (002 spec, Assumptions).
export const MAX_DOCUMENT_BYTES = 1024 * 1024;

// The draft a new workflow starts from: one step that sets a greeting.
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

// The draft's size in bytes, as JSON.
export function sizeOf(draft: JsonObject): number {
  return new TextEncoder().encode(JSON.stringify(draft)).length;
}
