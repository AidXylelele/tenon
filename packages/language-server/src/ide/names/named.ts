import type {
  Occurrence,
  Position,
  Range,
  RangeLocator,
  SemanticModel,
} from "interpreter/front-end";
import {
  declarationOf,
  placeAt,
  type Reading,
  readingOf,
} from "../places/index.js";
import { valueAt } from "../pointers/index.js";
import type { Snapshot } from "../snapshot/index.js";
import { targetOf } from "../steps/index.js";
import { binderAt, binderDefinitionOf, binderUsesOf } from "./binders.js";
import type { Named } from "./interfaces.js";

export function definitionAt(
  snapshot: Snapshot,
  position: Position,
): Range | null {
  const reading = readingOf(snapshot);
  const binder = binderAt(reading, position);

  if (binder !== null) {
    return binderDefinitionOf(reading, binder);
  }

  const positions = reading.source?.positions ?? null;
  const model = reading.semantics?.model ?? null;
  const named = namedAt(reading, position);

  if (positions === null || model === null || named === null) {
    return null;
  }

  const declaration = namedDeclarationOf(model, named);

  if (declaration === null) {
    return null;
  }

  return nameRangeOf(positions, declaration);
}

export function usesAt(
  snapshot: Snapshot,
  position: Position,
): readonly Range[] {
  const reading = readingOf(snapshot);
  const binder = binderAt(reading, position);

  if (binder !== null) {
    return binderUsesOf(reading, binder) ?? [];
  }

  const source = reading.source;
  const positions = source?.positions ?? null;
  const model = reading.semantics?.model ?? null;
  const named = namedAt(reading, position);

  if (source === null || positions === null || model === null) {
    return [];
  }

  if (named === null) {
    return [];
  }

  const name = nameOf(named);
  const pointers = usePointersOf(model, named);
  const written = pointers.filter((pointer) => {
    const value = valueAt(source.document, pointer);
    return value === name;
  });

  return written.flatMap((pointer) => {
    const range = positions.rangeOf(pointer);
    return range === null ? [] : [range];
  });
}

export function namedAt(reading: Reading, position: Position): Named | null {
  const semantics = reading.semantics;

  if (semantics === null) {
    return null;
  }

  const { model, tree } = semantics;
  const place = placeAt(reading, position);

  switch (place.kind) {
    case "stepName": {
      const step = tree.steps.get(place.step) ?? null;
      return step === null ? null : { kind: "task", step };
    }
    case "label": {
      const jumps = model.symbols.jumps;
      const step = targetOf(tree, jumps, place.directive);
      return step === null ? null : { kind: "task", step };
    }
    case "component":
    case "reference":
      return { kind: "component", table: place.table, name: place.name };
    case "member":
    case "nothing":
      return null;
  }
}

function nameOf(named: Named): string {
  switch (named.kind) {
    case "task":
      return named.step.name;
    case "component":
      return named.name;
  }
}

export function namedDeclarationOf(
  model: SemanticModel,
  named: Named,
): string | null {
  switch (named.kind) {
    case "task":
      return named.step.pointer;
    case "component":
      return declarationOf(model, named.table, named.name);
  }
}

export function usePointersOf(
  model: SemanticModel,
  named: Named,
): readonly string[] {
  switch (named.kind) {
    case "task": {
      const jumps = [...model.symbols.jumps];
      const targeting = jumps.filter(
        ([, target]) => target === named.step.pointer,
      );
      return targeting.map(([directive]) => directive);
    }
    case "component":
      return model.occurrences.flatMap((occurrence) =>
        referencePointersOf(occurrence, named),
      );
  }
}

export function nameRangeOf(
  positions: RangeLocator,
  pointer: string,
): Range | null {
  const key = positions.keyRangeOf(pointer);

  if (key !== null) {
    return key;
  }

  const item = positions.itemRangeOf(pointer);

  return item === null ? null : positions.rangeOf(pointer);
}

function referencePointersOf(
  occurrence: Occurrence,
  named: Named & { readonly kind: "component" },
): readonly string[] {
  switch (occurrence.kind) {
    case "reference": {
      const reference = occurrence.reference;
      const isNamed =
        occurrence.table === named.table && reference.name === named.name;
      return isNamed ? [reference.pointer] : [];
    }
    case "call": {
      const callee = occurrence.call.function;
      const isNamed = named.table === "functions" && callee.name === named.name;
      return isNamed ? [callee.pointer] : [];
    }
    case "task":
    case "list":
    case "binders":
    case "expression":
    case "duration":
    case "schema":
    case "filter":
    case "policy":
      return [];
  }
}
