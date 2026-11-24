import type {
  ComponentTable,
  JsonValue,
  PointerAt,
  Position,
  RangeLocator,
  SemanticModel,
} from "interpreter/front-end";
import { lastTokenOf, parentPointerOf, valueAt } from "../pointers/index.js";
import { modelOf, type Snapshot, sourceOf } from "../snapshot/index.js";
import { directiveAt, stepTreeOf } from "../steps/index.js";
import { offsetOf } from "../text/index.js";
import { referenceTableAt } from "./components.js";
import type { ComponentKind, Place, Reading, Semantics } from "./interfaces.js";

const nothing: Place = { kind: "nothing" };

const boundary = /^[\s:,\]}]?$/;

export function readingOf(snapshot: Snapshot): Reading {
  const source = sourceOf(snapshot.analysis);
  const model = modelOf(snapshot);

  if (model === null) {
    return { text: snapshot.text, source, semantics: null };
  }

  const tree = stepTreeOf(model.workflow);
  return { text: snapshot.text, source, semantics: { model, tree } };
}

export function placeAt(reading: Reading, position: Position): Place {
  const { source, semantics } = reading;
  const positions = source?.positions ?? null;

  if (source === null || positions === null) {
    return nothing;
  }

  const read = readAt(positions, reading.text, position);

  if (read === null) {
    return nothing;
  }

  const named =
    semantics === null ? null : namedPlaceOf(semantics, read, source.document);

  return named ?? memberPlaceOf(read);
}

function readAt(
  positions: RangeLocator,
  text: string,
  position: Position,
): PointerAt | null {
  const offset = offsetOf(text, position);
  const character = text.charAt(offset);
  const isAtBoundary = boundary.test(character) && position.column > 1;

  if (!isAtBoundary) {
    return positions.pointerAt(position);
  }

  const before = { line: position.line, column: position.column - 1 };
  return positions.pointerAt(before);
}

function namedPlaceOf(
  semantics: Semantics,
  read: PointerAt,
  document: JsonValue,
): Place | null {
  switch (read.part) {
    case "key":
      return nameKeyPlaceOf(semantics, read.pointer);
    case "value":
      return nameValuePlaceOf(semantics, read.pointer, document);
  }
}

function nameKeyPlaceOf(semantics: Semantics, pointer: string): Place | null {
  const isStep = semantics.tree.steps.has(pointer);

  if (isStep) {
    return { kind: "stepName", step: pointer };
  }

  const tablePointer = parentPointerOf(pointer);
  const table = lastTokenOf(tablePointer);
  const name = lastTokenOf(pointer);
  const isDeclared = declares(semantics.model, tablePointer, name);
  const components = semantics.model.symbols.components;
  const isComponent = isComponentKind(components, table);

  if (!isDeclared || !isComponent) {
    return null;
  }

  return { kind: "component", table, name, declaration: pointer };
}

function nameValuePlaceOf(
  semantics: Semantics,
  pointer: string,
  document: JsonValue,
): Place | null {
  const written = valueAt(document, pointer);

  if (typeof written !== "string") {
    return null;
  }

  const directive = directiveAt(semantics.tree, pointer);

  if (directive?.kind === "label") {
    return { kind: "label", directive: pointer, name: written };
  }

  const table = referenceTableAt(semantics.model, pointer);

  if (table !== null) {
    return { kind: "reference", table, pointer, name: written };
  }

  const tablePointer = parentPointerOf(pointer);
  const isSecret = tablePointer === "/use/secrets";
  const isDeclared = declares(semantics.model, "/use/secrets", written);

  if (!isSecret || !isDeclared) {
    return null;
  }

  return {
    kind: "component",
    table: "secrets",
    name: written,
    declaration: pointer,
  };
}

function declares(
  model: SemanticModel,
  tablePointer: string,
  name: string,
): boolean {
  const components = model.symbols.components;
  const kind = lastTokenOf(tablePointer);
  const holder = parentPointerOf(tablePointer);
  const isUse = holder === "/use";
  const isComponent = isComponentKind(components, kind);

  if (!isUse || !isComponent) {
    return false;
  }

  return components[kind].has(name);
}

function isComponentKind(
  components: ComponentTable,
  token: string,
): token is ComponentKind {
  return Object.hasOwn(components, token);
}

function memberPlaceOf(read: PointerAt): Place {
  const { pointer, part } = read;
  const isRoot = pointer === "";

  if (isRoot) {
    return nothing;
  }

  const object = parentPointerOf(pointer);
  const name = lastTokenOf(pointer);
  return { kind: "member", object, name, part, pointer };
}
