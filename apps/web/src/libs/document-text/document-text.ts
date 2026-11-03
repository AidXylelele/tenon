import {
  isMap,
  isPair,
  isScalar,
  isSeq,
  type Node,
  parseDocument,
  stringify,
} from 'yaml';
import { tokensOf } from './json-pointer';

// A document as text, YAML or JSON (JSON is YAML 1.2, so one parser reads both), with the
// positions the code view needs: where a parse error is, and where a JSON Pointer points.

export type TextFormat = 'yaml' | 'json';

export interface TextRange {
  readonly from: number;
  readonly to: number;
}

export interface TextError extends TextRange {
  readonly message: string;
  readonly line: number;
  readonly column: number;
}

export type ParsedText =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: TextError };

// Aliases expand into copies; a bound keeps an alias bomb from exhausting the browser.
const MAX_ALIASES = 100;

export function parseText(text: string): ParsedText {
  const document = parseDocument(text, {
    uniqueKeys: true,
    prettyErrors: true,
  });
  const [error] = document.errors;

  if (error !== undefined) {
    const [from, to] = error.pos;
    const position = error.linePos?.[0];
    const message = error.message.split('\n')[0] ?? error.message;
    return {
      ok: false,
      error: {
        message,
        from,
        to,
        line: position?.line ?? 1,
        column: position?.col ?? 1,
      },
    };
  }

  try {
    return {
      ok: true,
      value: document.toJS({ maxAliasCount: MAX_ALIASES }) as unknown,
    };
  } catch (failure) {
    const message =
      failure instanceof Error ? failure.message : String(failure);
    return {
      ok: false,
      error: { message, from: 0, to: 0, line: 1, column: 1 },
    };
  }
}

export function stringifyText(value: unknown, format: TextFormat): string {
  if (format === 'json') return `${JSON.stringify(value, null, 2)}\n`;

  return stringify(value, { lineWidth: 0 });
}

// Whether a text reads as JSON rather than YAML: it opens with a brace or a bracket.
export function formatOf(text: string): TextFormat {
  const first = text.trimStart()[0];
  return first === '{' || first === '[' ? 'json' : 'yaml';
}

// The text range a JSON Pointer points to: the member or item itself, or the deepest part of
// the path that exists when the rest does not.
export function rangeOf(text: string, pointer: string): TextRange | null {
  const document = parseDocument(text, { uniqueKeys: false });
  let node: unknown = document.contents;
  let range = rangeOfNode(node);

  for (const token of tokensOf(pointer)) {
    if (isMap(node)) {
      const pair = node.items.find(
        (item) =>
          isPair(item) &&
          isScalar(item.key) &&
          String(item.key.value) === token,
      );

      if (pair === undefined) return range;

      const key = rangeOfNode(pair.key);
      const value = rangeOfNode(pair.value);
      range =
        key !== null ? { from: key.from, to: value?.to ?? key.to } : value;
      node = pair.value;
      continue;
    }

    if (isSeq(node)) {
      const item: unknown = node.items[Number(token)];

      if (item === undefined) return range;

      range = rangeOfNode(item) ?? range;
      node = item;
      continue;
    }

    return range;
  }

  return range;
}

function rangeOfNode(node: unknown): TextRange | null {
  if (node === null || typeof node !== 'object' || !('range' in node))
    return null;

  const span = (node as Node).range;

  if (span === undefined || span === null) return null;

  return { from: span[0], to: span[1] };
}
