import type { Position } from "interpreter/front-end";

const cursorMark = "‸";

interface Fixture {
  readonly text: string;
  readonly cursor: Position;
}

export function fixtureOf(marked: string): Fixture {
  const at = marked.indexOf(cursorMark);

  if (at === -1) {
    throw new Error("The fixture marks no cursor.");
  }

  const before = marked.slice(0, at);
  const after = marked.slice(at + cursorMark.length);
  const lines = before.split("\n");
  const line = lines.length;
  const column = (lines.at(-1) ?? "").length + 1;

  return { text: before + after, cursor: { line, column } };
}
