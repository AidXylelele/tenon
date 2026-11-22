import {
  type ast,
  type BinderBinding,
  type Binding,
  type Position,
  type Range,
  resolutionsOf,
} from "interpreter/front-end";
import type { Reading } from "../places/index.js";
import { valueAt } from "../pointers/index.js";
import { textIn } from "../text/index.js";
import type { Token, Variable } from "./interfaces.js";

const variables = /\$[A-Za-z_]\w*|\$/g;

export function variableAt(
  reading: Reading,
  pointer: string,
  position: Position,
): Variable | null {
  const model = reading.semantics?.model ?? null;
  const resolutions = model === null ? [] : resolutionsOf(model, pointer);
  const [resolution] = resolutions;

  if (resolution === undefined) {
    return null;
  }

  const expression = resolution.expression;
  const start = sourceStartOf(reading, expression);
  const isOnLine = start !== null && start.line === position.line;

  if (!isOnLine) {
    return null;
  }

  const offset = position.column - start.column;
  const token = tokenAround(expression.source, offset);

  if (token === null) {
    return null;
  }

  const name = expression.source.slice(token.from + 1, token.to);
  const line = start.line;
  const range = {
    start: { line, column: start.column + token.from },
    end: { line, column: start.column + token.to },
  };
  return { name, range, resolution };
}

export function tokenRangesOf(
  reading: Reading,
  expression: ast.Expression,
  name: string,
): readonly Range[] | null {
  const start = sourceStartOf(reading, expression);

  if (start === null) {
    return null;
  }

  const written = "$" + name;
  const found = [...expression.source.matchAll(variables)];
  const named = found.filter((match) => match[0] === written);
  const line = start.line;

  return named.map((match) => {
    const column = start.column + match.index;
    const end = column + written.length;
    return { start: { line, column }, end: { line, column: end } };
  });
}

export function bindingNounOf(binding: Binding): string {
  switch (binding.kind) {
    case "argument":
      return "runtime argument";
    case "binder":
      return binderNounOf(binding.role);
  }
}

function binderNounOf(role: BinderBinding["role"]): string {
  switch (role) {
    case "item":
      return "loop item";
    case "index":
      return "loop index";
    case "error":
      return "caught error";
  }
}

function sourceStartOf(
  reading: Reading,
  expression: ast.Expression,
): Position | null {
  const source = reading.source;
  const range = source?.positions?.rangeOf(expression.pointer) ?? null;

  if (source === null || range === null) {
    return null;
  }

  const written = textIn(reading.text, range);
  const value = valueAt(source.document, expression.pointer);
  const opening = written.charAt(0);
  const isQuoted = opening === '"' || opening === "'";
  const content = isQuoted ? written.slice(1, -1) : written;
  const isLinear = content === value;

  if (!isLinear) {
    return null;
  }

  const quote = isQuoted ? 1 : 0;
  const column = range.start.column + expression.sourceOffset + quote;
  return { line: range.start.line, column };
}

function tokenAround(source: string, offset: number): Token | null {
  const found = [...source.matchAll(variables)];
  const holding = found.find((match) => {
    const end = match.index + match[0].length;
    return match.index <= offset && offset <= end;
  });

  if (holding === undefined) {
    return null;
  }

  const to = holding.index + holding[0].length;
  return { from: holding.index, to };
}
