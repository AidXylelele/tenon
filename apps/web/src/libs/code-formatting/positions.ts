interface Position {
  readonly line: number;
  readonly column: number;
}

const NEW_LINE = "\n";

export function keptCursor(
  before: string,
  after: string,
  cursor: number,
): number {
  const position = positionOf(before, cursor);
  return offsetOf(after, position);
}

export function lineWithin(text: string, line: number): number {
  const lines = text.split(NEW_LINE);
  return Math.min(line, lines.length);
}

function positionOf(text: string, offset: number): Position {
  const preceding = text.slice(0, offset);
  const lines = preceding.split(NEW_LINE);
  const line = lines.length - 1;
  const current = lines.at(-1) ?? "";
  return { line, column: current.length };
}

function offsetOf(text: string, position: Position): number {
  const lines = text.split(NEW_LINE);
  const last = lines.length - 1;
  const line = Math.min(position.line, last);
  const earlier = lines.slice(0, line);
  const start = earlier.reduce(
    (sum, earlierLine) => sum + earlierLine.length + 1,
    0,
  );
  const current = lines[line] ?? "";
  const column = Math.min(position.column, current.length);
  return start + column;
}
