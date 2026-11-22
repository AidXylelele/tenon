import type { Position, Range } from "interpreter/front-end";
import type { TextChange } from "./interfaces.js";

const lineBreak = /\r\n|\r|\n/g;

export function offsetOf(text: string, position: Position): number {
  const starts = lineStartsOf(text);
  const start = starts[position.line - 1] ?? text.length;

  return start + position.column - 1;
}

export function positionAt(text: string, offset: number): Position {
  const starts = lineStartsOf(text);
  const following = starts.findIndex((start) => start > offset);
  const line = following === -1 ? starts.length : following;
  const start = starts[line - 1] ?? 0;

  return { line, column: offset - start + 1 };
}

export function textIn(text: string, range: Range): string {
  const start = offsetOf(text, range.start);
  const end = offsetOf(text, range.end);

  return text.slice(start, end);
}

export function lineTextAt(text: string, position: Position): string {
  const starts = lineStartsOf(text);
  const start = starts[position.line - 1] ?? text.length;
  const next = starts[position.line] ?? text.length;
  const line = text.slice(start, next);

  return line.replace(/\r?\n$|\r$/, "");
}

export function comparedPositions(one: Position, other: Position): number {
  const lines = one.line - other.line;

  return lines === 0 ? one.column - other.column : lines;
}

function lineStartsOf(text: string): readonly number[] {
  const breaks = [...text.matchAll(lineBreak)];
  const afterBreaks = breaks.map((found) => found.index + found[0].length);

  return [0, ...afterBreaks];
}

export function dedentedOf(block: string, indent: number): string {
  const margin = " ".repeat(indent);
  const lines = block.split("\n");
  const dedented = lines.map((line) =>
    line.startsWith(margin) ? line.slice(indent) : line.trimStart(),
  );

  return dedented.join("\n");
}

export function indentedOf(block: string, indent: number): string {
  const margin = " ".repeat(indent);
  const lines = block.split("\n");
  const indented = lines.map((line) => (line === "" ? line : margin + line));

  return indented.join("\n");
}

export function appliedOf(
  text: string,
  changes: readonly TextChange[],
): string {
  const fromTheEnd = changes.toReversed();

  return fromTheEnd.reduce((edited, change) => {
    const start = offsetOf(edited, change.range.start);
    const end = offsetOf(edited, change.range.end);
    return edited.slice(0, start) + change.text + edited.slice(end);
  }, text);
}
