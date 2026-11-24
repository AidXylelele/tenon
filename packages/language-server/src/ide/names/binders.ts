import {
  type BinderBinding,
  type Binding,
  type ExpressionResolution,
  type JsonValue,
  type Position,
  type Range,
  runtimeArguments,
  type SemanticModel,
} from "interpreter/front-end";
import { tokenRangesOf, variableAt } from "../expressions/index.js";
import { placeAt, type Reading } from "../places/index.js";
import {
  childPointerOf,
  isJsonObject,
  parentPointerOf,
  valueAt,
} from "../pointers/index.js";
import { comparedPositions, type TextChange, textIn } from "../text/index.js";
import { scalarLike } from "../yaml-text/index.js";
import type { Renaming } from "./interfaces.js";

const expressionName = /^[A-Za-z_]\w*$/;

const argumentNames: ReadonlySet<string> = new Set(runtimeArguments);

export function binderAt(
  reading: Reading,
  position: Position,
): BinderBinding | null {
  const { source, semantics } = reading;
  const place = placeAt(reading, position);
  const isValue = place.kind === "member" && place.part === "value";

  if (!isValue || source === null || semantics === null) {
    return null;
  }

  const variable = variableAt(reading, place.pointer, position);

  if (variable !== null) {
    const binding = variable.resolution.scope.get(variable.name);
    return binding?.kind === "binder" ? binding : null;
  }

  const binders = bindersOf(semantics.model);
  const declared = binders.find((binder) => {
    const pointer = namePointerOf(binder, source.document);
    return pointer === place.pointer;
  });

  return declared ?? null;
}

export function binderDefinitionOf(
  reading: Reading,
  binder: BinderBinding,
): Range | null {
  const source = reading.source;
  const positions = source?.positions ?? null;

  if (source === null || positions === null) {
    return null;
  }

  const pointer = namePointerOf(binder, source.document);
  const isWritten = valueAt(source.document, pointer) !== undefined;

  if (isWritten) {
    return positions.rangeOf(pointer);
  }

  const declaring = parentPointerOf(pointer);
  return positions.keyRangeOf(declaring);
}

export function binderUsesOf(
  reading: Reading,
  binder: BinderBinding,
): readonly Range[] | null {
  const model = reading.semantics?.model ?? null;

  if (model === null) {
    return [];
  }

  const readers = readersOf(model, binder);
  const ranges = readers.map((resolution) =>
    tokenRangesOf(reading, resolution.expression, binder.name),
  );
  const isPlaced = ranges.every((placed) => placed !== null);

  if (!isPlaced) {
    return null;
  }

  const uses = ranges.flat();
  return uses.toSorted((one, other) =>
    comparedPositions(one.start, other.start),
  );
}

export function binderRenamingOf(
  reading: Reading,
  binder: BinderBinding,
  name: string,
): Renaming {
  const model = reading.semantics?.model ?? null;
  const source = reading.source;

  if (model === null || source === null) {
    return { kind: "refused", reason: "Nothing here can be renamed." };
  }

  const conflict = binderConflictOf(model, binder, name);

  if (conflict !== null) {
    return { kind: "refused", reason: conflict };
  }

  const pointer = namePointerOf(binder, source.document);
  const isWritten = valueAt(source.document, pointer) !== undefined;
  const declaration = source.positions?.rangeOf(pointer) ?? null;

  if (!isWritten || declaration === null) {
    return {
      kind: "refused",
      reason: `'${binder.name}' is the default name here; write it in the text to rename it.`,
    };
  }

  const uses = binderUsesOf(reading, binder);

  if (uses === null) {
    return {
      kind: "refused",
      reason:
        "An expression that reads it has escapes or folded lines; rename it in the text.",
    };
  }

  const written = textIn(reading.text, declaration);
  const renamed = scalarLike(written, name);
  const declared = { range: declaration, text: renamed };
  const variable = "$" + name;
  const read = uses.map((range): TextChange => ({ range, text: variable }));
  const changes = [declared, ...read].toSorted((one, other) =>
    comparedPositions(one.range.start, other.range.start),
  );

  return { kind: "renamed", changes };
}

function binderConflictOf(
  model: SemanticModel,
  binder: BinderBinding,
  name: string,
): string | null {
  if (name === "") {
    return "A name cannot be empty.";
  }

  const isExpressionName = expressionName.test(name);

  if (!isExpressionName) {
    return `'${name}' is not a name an expression can read.`;
  }

  const isArgument = argumentNames.has(name);

  if (isArgument) {
    return `'${name}' is a runtime argument.`;
  }

  const binders = bindersOf(model);
  const scopes = [...model.resolutions.values()].map(
    (resolution) => resolution.scope,
  );
  const holding = scopes.filter((scope) => {
    const bound = scope.get(binder.name);
    return isSameBinder(bound, binder);
  });
  const isTakenInScope = holding.some((scope) => {
    const taken = scope.get(name);
    return taken !== undefined && !isSameBinder(taken, binder);
  });
  const isTakenBeside = binders.some(
    (other) =>
      other.declaration === binder.declaration &&
      other.role !== binder.role &&
      other.name === name,
  );

  if (isTakenInScope || isTakenBeside) {
    return `A name '${name}' is already in scope here.`;
  }

  return null;
}

function readersOf(
  model: SemanticModel,
  binder: BinderBinding,
): readonly ExpressionResolution[] {
  const resolutions = [...model.resolutions.values()];
  const reading = resolutions.filter((resolution) => {
    const bound = resolution.bindings.get(binder.name);
    return isSameBinder(bound, binder);
  });

  return reading.filter(
    (resolution, index) =>
      reading.findIndex(
        (other) => other.expression.pointer === resolution.expression.pointer,
      ) === index,
  );
}

function bindersOf(model: SemanticModel): readonly BinderBinding[] {
  return model.occurrences.flatMap((occurrence) =>
    occurrence.kind === "binders" ? occurrence.binders : [],
  );
}

function namePointerOf(binder: BinderBinding, document: JsonValue): string {
  const declaration = binder.declaration;
  const loop = childPointerOf(declaration, "for");
  const loopValue = valueAt(document, loop);
  const isLoop = isJsonObject(loopValue);
  const holder = isLoop ? loop : declaration;
  const itemMember = isLoop ? "each" : "item";

  switch (binder.role) {
    case "error":
      return childPointerOf(declaration, "as");
    case "index":
      return childPointerOf(holder, "at");
    case "item":
      return childPointerOf(holder, itemMember);
  }
}

function isSameBinder(
  binding: Binding | undefined,
  binder: BinderBinding,
): boolean {
  return (
    binding?.kind === "binder" &&
    binding.declaration === binder.declaration &&
    binding.role === binder.role
  );
}
