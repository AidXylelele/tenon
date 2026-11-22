import type { JsonValue } from "../../api/index.js";
import type { Expression, TermId } from "../../core/index.js";
import {
  type CompiledExpression,
  type Evaluation,
  InterpreterError,
  Raised,
  isTruthy,
} from "../../runtime/index.js";
import type { Here } from "../registers/index.js";
import type { HeldTemplate, View } from "../view.js";
import { argumentsOf } from "./arguments.js";
import { shownMessageOf } from "./secret-reads.js";

export type RequestValues = ReadonlyMap<TermId, JsonValue>;

export function expressionValueOf(
  expression: Expression,
  here: Here,
  view: View,
): JsonValue {
  const compiled = compiledOf(expression, view);
  const read = argumentsOf(expression, here.scope, view);
  const evaluation: Evaluation = {
    expression: compiled,
    input: here.value,
    arguments: read,
    now: view.context.now,
  };
  const evaluated = view.services.expressions.evaluate(evaluation);

  switch (evaluated.kind) {
    case "value":
      return evaluated.value;
    case "failed":
      return failedOf(expression, evaluated.message);
  }
}

export function holds(
  conditions: readonly Expression[],
  here: Here,
  view: View,
): boolean {
  return conditions.every((condition) => {
    const value = expressionValueOf(condition, here, view);
    return isTruthy(value);
  });
}

function requestValuesOf(
  expressions: readonly Expression[],
  here: Here,
  view: View,
): RequestValues {
  const entries = expressions.map((expression) => {
    const value = expressionValueOf(expression, here, view);
    return [expression.id, value] as const;
  });

  return new Map(entries);
}

export function heldValuesOf(
  template: HeldTemplate,
  here: Here,
  view: View,
): RequestValues {
  const held = view.statics.held.get(template);

  if (held === undefined) {
    throw new InterpreterError(
      `The runner holds no expressions of the ${template.kind} request.`,
    );
  }

  return requestValuesOf(held, here, view);
}

export function evaluatedValueOf(
  values: RequestValues,
  expression: Expression,
): JsonValue {
  const value = values.get(expression.id);

  if (value === undefined) {
    throw new InterpreterError(
      `The request evaluated no expression '${expression.id}'.`,
    );
  }

  return value;
}

function compiledOf(expression: Expression, view: View): CompiledExpression {
  const compiled = view.program.expressions.get(expression.id);

  if (compiled === undefined) {
    throw new InterpreterError(
      `The program compiled no expression '${expression.id}'.`,
    );
  }

  return compiled;
}

function failedOf(expression: Expression, message: string): JsonValue {
  switch (expression.mode) {
    case "loose":
      return expression.source;
    case "strict": {
      const detail = shownMessageOf(expression, message);
      throw Raised.standard("expression", detail);
    }
  }
}
