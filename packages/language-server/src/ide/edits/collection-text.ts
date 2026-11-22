import type { Range } from "interpreter/front-end";
import { childPointerOf, parentPointerOf, valueAt } from "../pointers/index.js";
import type { StepNodeList } from "../steps/index.js";
import {
  comparedPositions,
  dedentedOf,
  indentedOf,
  lineTextAt,
  offsetOf,
  positionAt,
  type TextChange,
} from "../text/index.js";
import { inlineYamlOf } from "../yaml-text/index.js";
import type {
  CollectionText,
  EditableText,
  ItemText,
  Span,
  WrittenItem,
} from "./interfaces.js";

export function listTextOf(
  editable: EditableText,
  list: StepNodeList,
): CollectionText | null {
  const items = list.steps.map((step) => parentPointerOf(step.pointer));

  return collectionTextOf(editable, list.pointer, items);
}

export function mappingTextOf(
  editable: EditableText,
  pointer: string,
  keys: readonly string[],
): CollectionText | null {
  const members = keys.map((key) => childPointerOf(pointer, key));

  return collectionTextOf(editable, pointer, members);
}

export function sequenceTextOf(
  editable: EditableText,
  pointer: string,
  length: number,
): CollectionText | null {
  const indices = Array.from({ length }, (_, index) => String(index));
  const items = indices.map((index) => childPointerOf(pointer, index));

  return collectionTextOf(editable, pointer, items);
}

export function withoutItem(
  collection: CollectionText,
  span: Span,
): CollectionText {
  const items = collection.items.filter((item) => item !== span);

  return { ...collection, items };
}

export function itemFormsOf(
  collection: CollectionText,
  item: WrittenItem,
): ItemText {
  switch (collection.kind) {
    case "block": {
      const block = dedentedOf(item.text, collection.indent);
      const inline = inlineYamlOf(item.value);
      return { block, inline };
    }
    case "flow": {
      const block = `- ${item.text}\n`;
      return { block, inline: item.text };
    }
  }
}

export function insertionOf(
  collection: CollectionText,
  index: number,
  item: ItemText,
): TextChange {
  switch (collection.kind) {
    case "block":
      return blockInsertionOf(collection, index, item);
    case "flow":
      return flowInsertionOf(collection, index, item);
  }
}

export function removalOf(
  collection: CollectionText,
  span: Span,
): readonly TextChange[] {
  switch (collection.kind) {
    case "block":
      return blockRemovalOf(collection, span);
    case "flow": {
      const removal = flowRemovalOf(collection, span);
      return [removal];
    }
  }
}

export function changeOf(
  text: string,
  span: Span,
  replacement: string,
): TextChange {
  const start = positionAt(text, span.start);
  const end = positionAt(text, span.end);

  return { range: { start, end }, text: replacement };
}

export function inTextOrder(
  changes: readonly TextChange[],
): readonly TextChange[] {
  return changes.toSorted((one, other) => {
    const starts = comparedPositions(one.range.start, other.range.start);
    const ends = comparedPositions(one.range.end, other.range.end);
    return starts === 0 ? ends : starts;
  });
}

export function afterColonOf(text: string, key: Range): number {
  const keyEnd = offsetOf(text, key.end);
  const colon = text.indexOf(":", keyEnd);

  return colon + 1;
}

function collectionTextOf(
  editable: EditableText,
  pointer: string,
  items: readonly string[],
): CollectionText | null {
  const { text, positions } = editable;
  const range = positions.rangeOf(pointer);
  const key = positions.keyRangeOf(pointer);
  const itemRanges = items.map((item) => positions.itemRangeOf(item));
  const written = itemRanges.filter((itemRange) => itemRange !== null);
  const isWhole = written.length === itemRanges.length;

  if (range === null || !isWhole) {
    return null;
  }

  const opening = openingOf(text, range);
  const isFlow = opening === "[" || opening === "{";
  const value = valueAt(editable.document, pointer);
  const empty = Array.isArray(value) ? "[]" : "{}";
  const isEmptyInBlock =
    isFlow && written.length === 0 && isBlockMember(editable, pointer);

  if (isEmptyInBlock && key !== null) {
    const afterKey = afterColonOf(text, key);
    const end = offsetOf(text, range.end);
    const placeholder = { start: afterKey, end };
    const indent = key.start.column + 1;
    return {
      kind: "block",
      text,
      items: [],
      indent,
      afterKey,
      empty,
      placeholder,
    };
  }

  if (isFlow) {
    const spans = written.map((itemRange) => spanOf(text, itemRange));
    const whole = spanOf(text, range);
    return { kind: "flow", text, items: spans, whole, empty };
  }

  const spans = written.map((itemRange) => blockSpanOf(text, itemRange));
  const first = written[0]?.start.column ?? range.start.column;
  const indent = first - 1;
  const afterKey =
    key === null ? offsetOf(text, range.start) : afterColonOf(text, key);
  return {
    kind: "block",
    text,
    items: spans,
    indent,
    afterKey,
    empty,
    placeholder: null,
  };
}

function isBlockMember(editable: EditableText, pointer: string): boolean {
  const { text, positions } = editable;
  const parent = parentPointerOf(pointer);
  const parentRange = positions.rangeOf(parent);
  const opening = parentRange === null ? "" : openingOf(text, parentRange);

  return opening !== "{" && opening !== "[";
}

function openingOf(text: string, range: Range): string {
  const start = offsetOf(text, range.start);

  return text.charAt(start);
}

function blockInsertionOf(
  collection: CollectionText & { readonly kind: "block" },
  index: number,
  item: ItemText,
): TextChange {
  const text = collection.text;
  const indented = indentedOf(item.block, collection.indent);
  const following = collection.items[index];
  const placeholder = collection.placeholder;

  if (placeholder !== null) {
    const lines = indented.trimEnd();
    return changeOf(text, placeholder, `\n${lines}`);
  }

  if (following !== undefined) {
    const at = { start: following.start, end: following.start };
    return changeOf(text, at, indented);
  }

  const last = collection.items.at(-1)?.end ?? collection.afterKey;
  const before = text.slice(0, last);
  const separator = before.endsWith("\n") ? "" : "\n";
  const inserted = separator + indented;
  const at = { start: last, end: last };
  return changeOf(text, at, inserted);
}

function flowInsertionOf(
  collection: CollectionText & { readonly kind: "flow" },
  index: number,
  item: ItemText,
): TextChange {
  const text = collection.text;
  const following = collection.items[index];
  const last = collection.items.at(-1);

  if (following !== undefined) {
    const at = { start: following.start, end: following.start };
    const inserted = `${item.inline}, `;
    return changeOf(text, at, inserted);
  }

  if (last !== undefined) {
    const at = { start: last.end, end: last.end };
    const inserted = `, ${item.inline}`;
    return changeOf(text, at, inserted);
  }

  const opening = collection.empty.charAt(0);
  const closing = collection.empty.charAt(1);
  const filled = `${opening} ${item.inline} ${closing}`;
  return changeOf(text, collection.whole, filled);
}

function blockRemovalOf(
  collection: CollectionText & { readonly kind: "block" },
  span: Span,
): readonly TextChange[] {
  const text = collection.text;
  const removal = changeOf(text, span, "");
  const isOnly = collection.items.length === 1;

  if (!isOnly) {
    return [removal];
  }

  const afterKey = { start: collection.afterKey, end: collection.afterKey };
  const emptied = ` ${collection.empty}`;
  const emptying = changeOf(text, afterKey, emptied);
  return [emptying, removal];
}

function flowRemovalOf(
  collection: CollectionText & { readonly kind: "flow" },
  span: Span,
): TextChange {
  const { text, items } = collection;
  const index = items.indexOf(span);
  const next = items[index + 1];
  const previous = items[index - 1];

  if (next !== undefined) {
    const withComma = { start: span.start, end: next.start };
    return changeOf(text, withComma, "");
  }

  if (previous !== undefined) {
    const withComma = { start: previous.end, end: span.end };
    return changeOf(text, withComma, "");
  }

  return changeOf(text, collection.whole, collection.empty);
}

function spanOf(text: string, range: Range): Span {
  const start = offsetOf(text, range.start);
  const end = offsetOf(text, range.end);

  return { start, end };
}

function blockSpanOf(text: string, range: Range): Span {
  const indent = range.start.column - 1;
  const endsAtLineStart = range.end.column === 1;
  const lastWritten = endsAtLineStart ? range.end.line - 1 : range.end.line;
  const first = firstLineOf(text, range.start.line, indent);
  const last = lastLineOf(text, lastWritten, indent);
  const firstStart = { line: first, column: 1 };
  const afterLast = { line: last + 1, column: 1 };
  const start = offsetOf(text, firstStart);
  const end = offsetOf(text, afterLast);

  return { start, end };
}

function firstLineOf(text: string, line: number, indent: number): number {
  const above = { line: line - 1, column: 1 };
  const written = lineTextAt(text, above);
  const commentIndent = commentIndentOf(written);
  const isLeadingComment = above.line > 0 && commentIndent === indent;

  return isLeadingComment ? firstLineOf(text, above.line, indent) : line;
}

function lastLineOf(text: string, line: number, indent: number): number {
  const below = { line: line + 1, column: 1 };
  const written = lineTextAt(text, below);
  const commentIndent = commentIndentOf(written);
  const isTrailingComment = commentIndent !== null && commentIndent > indent;

  return isTrailingComment ? lastLineOf(text, below.line, indent) : line;
}

function commentIndentOf(line: string): number | null {
  const trimmed = line.trimStart();
  const isComment = trimmed.startsWith("#");

  return isComment ? line.length - trimmed.length : null;
}
