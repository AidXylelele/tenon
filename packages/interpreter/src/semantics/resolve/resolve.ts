import {
  type ExpressionLanguage,
  InterpreterError,
} from "../../runtime/index.js";
import {
  argumentsAt,
  type Point,
  type RuntimeArgument,
} from "../../standard/index.js";
import type {
  Context,
  ExpressionOccurrence,
  Occurrence,
} from "../occurrences/index.js";
import type { Symbols } from "../symbols/index.js";
import { pointOf } from "./evaluation-points.js";
import { resolutionKeyOf } from "./resolution-keys.js";
import { substitutedOf } from "./substitution.js";
import type { Binding, ExpressionResolution, Resolutions } from "./types.js";

type Bound = readonly [string, Binding];

const unbound: readonly Bound[] = [];

export function resolve(
  occurrences: readonly Occurrence[],
  symbols: Symbols,
  expressions: ExpressionLanguage,
): Resolutions {
  const substituted = substitutedOf(occurrences, symbols.references);
  const evaluated = substituted.filter(
    (occurrence) => occurrence.kind === "expression",
  );
  const resolutions = evaluated.map((occurrence) =>
    resolutionEntryOf(occurrence, expressions),
  );

  return uniquelyKeyed(resolutions);
}

function uniquelyKeyed(
  entries: readonly (readonly [string, ExpressionResolution])[],
): Resolutions {
  const resolutions = new Map(entries);

  if (resolutions.size === entries.length) {
    return resolutions;
  }

  const keys = entries.map(([key]) => key);
  const repeated = keys.find((key, index) => keys.indexOf(key) !== index);
  throw new InterpreterError(
    `The expression '${repeated ?? ""}' is resolved twice.`,
  );
}

function resolutionEntryOf(
  occurrence: ExpressionOccurrence,
  expressions: ExpressionLanguage,
): readonly [string, ExpressionResolution] {
  const { expression, context } = occurrence;
  const point = pointOf(context.position);
  const scope = scopeOf(context, point);
  const candidates = expressions.variablesOf(expression.source);
  const bound = candidates.flatMap((name) => boundOf(name, scope));
  const bindings = new Map(bound);
  const key = resolutionKeyOf(expression.pointer, context.place);

  return [key, { expression, scope, bindings }];
}

function scopeOf(context: Context, point: Point): ReadonlyMap<string, Binding> {
  const available = argumentsAt(point).map(argumentBoundOf);
  const binders = context.scope.binders;

  return new Map([...available, ...binders]);
}

function argumentBoundOf(argument: RuntimeArgument): Bound {
  return [argument, { kind: "argument", argument }];
}

function boundOf(
  name: string,
  scope: ReadonlyMap<string, Binding>,
): readonly Bound[] {
  const binding = scope.get(name);

  if (binding === undefined) {
    return unbound;
  }

  return [[name, binding]];
}
