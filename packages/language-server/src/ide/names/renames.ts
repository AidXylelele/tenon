import type { Position, Range, SemanticModel } from "interpreter/front-end";
import {
  componentNounOf,
  placeAt,
  type Reading,
  readingOf,
  type Semantics,
} from "../places/index.js";
import type { Snapshot } from "../snapshot/index.js";
import { directiveAt, nameConflictOf, type StepNode } from "../steps/index.js";
import { comparedPositions, type TextChange, textIn } from "../text/index.js";
import { scalarLike } from "../yaml-text/index.js";
import { binderAt, binderRenamingOf } from "./binders.js";
import type { Named, Renaming } from "./interfaces.js";
import {
  namedAt,
  namedDeclarationOf,
  nameRangeOf,
  usePointersOf,
} from "./named.js";

export function renameAt(
  snapshot: Snapshot,
  position: Position,
  name: string,
): Renaming {
  const reading = readingOf(snapshot);
  const isAnalysed = snapshot.analysis.kind === "analyzed";

  if (!isAnalysed || reading.semantics === null) {
    return refusedFor("The document does not analyse; fix it before renaming.");
  }

  const binder = binderAt(reading, position);

  if (binder !== null) {
    return binderRenamingOf(reading, binder, name);
  }

  const keyword = keywordAt(reading, position);

  if (keyword !== null) {
    return refusedFor(`'${keyword}' is a flow directive, not a name.`);
  }

  const named = namedAt(reading, position);

  if (named === null) {
    return refusedFor("Nothing here can be renamed.");
  }

  const conflict = conflictOf(reading.semantics, named, name);

  if (conflict !== null) {
    return refusedFor(conflict);
  }

  const ranges = writtenRangesOf(reading.semantics.model, named);

  if (ranges.length === 0) {
    return refusedFor("Nothing here can be renamed.");
  }

  const changes = ranges.map((range) => changeOf(snapshot.text, range, name));
  return { kind: "renamed", changes };
}

function refusedFor(reason: string): Renaming {
  return { kind: "refused", reason };
}

function keywordAt(reading: Reading, position: Position): string | null {
  const place = placeAt(reading, position);
  const tree = reading.semantics?.tree ?? null;
  const isValue = place.kind === "member" && place.part === "value";

  if (!isValue || tree === null) {
    return null;
  }

  const directive = directiveAt(tree, place.pointer);
  const isKeyword = directive !== null && directive.kind !== "label";

  return isKeyword ? directive.kind : null;
}

function conflictOf(
  semantics: Semantics,
  named: Named,
  name: string,
): string | null {
  switch (named.kind) {
    case "task":
      return taskConflictOf(semantics, named.step, name);
    case "component":
      return componentConflictOf(semantics.model, named, name);
  }
}

function taskConflictOf(
  semantics: Semantics,
  step: StepNode,
  name: string,
): string | null {
  const list = semantics.tree.lists.get(step.list);

  if (list === undefined) {
    return "Nothing here can be renamed.";
  }

  return nameConflictOf(list, name, step.pointer);
}

function componentConflictOf(
  model: SemanticModel,
  named: Named & { readonly kind: "component" },
  name: string,
): string | null {
  if (name === "") {
    return "A name cannot be empty.";
  }

  const components = model.symbols.components;
  const symbol = components.functions.get(named.name);
  const isImported =
    named.table === "functions" && symbol?.origin === "imported";

  if (isImported) {
    return "An imported function is renamed in its catalog.";
  }

  if (named.table === "secrets") {
    return "A secret cannot be renamed here: expressions name it too.";
  }

  const isTaken = components[named.table].has(name);
  const noun = componentNounOf(named.table);

  return isTaken ? `A ${noun} named '${name}' is already declared.` : null;
}

function writtenRangesOf(model: SemanticModel, named: Named): readonly Range[] {
  const positions = model.source.positions;
  const declaration = namedDeclarationOf(model, named);

  if (positions === null || declaration === null) {
    return [];
  }

  const nameRange = nameRangeOf(positions, declaration);
  const uses = usePointersOf(model, named);
  const useRanges = uses.map((pointer) => positions.rangeOf(pointer));
  const ranges = [nameRange, ...useRanges].filter((range) => range !== null);

  return ranges.toSorted((one, other) =>
    comparedPositions(one.start, other.start),
  );
}

function changeOf(text: string, range: Range, name: string): TextChange {
  const written = textIn(text, range);
  const replacement = scalarLike(written, name);

  return { range, text: replacement };
}
