import type { List } from "immutable";
import type { JsonObject } from "../../api/index.js";
import { InterpreterError } from "../../runtime/index.js";
import { type Awaited, performAnswerOf } from "../frames/index.js";
import {
  type ExtensionSide,
  type ItemKey,
  type Path,
  type PathOf,
  attemptPathOf,
  eventKeyOf,
  extensionPathOf,
  iterationPathOf,
  messageKeyOf,
  performKeyOf,
  procedurePathOf,
  retryKeyOf,
  rootPath,
  schemaKeyOf,
  taskPathOf,
} from "../identity/index.js";
import {
  type KindSet,
  fieldAt,
  indexAt,
  kindAt,
  objectAt,
  ownMemberAt,
  stringAt,
} from "./fields.js";
import type { StateReader } from "./state-reader.js";
import type { StateWriter } from "./state-writer.js";

const pathKinds: KindSet<Path["kind"]> = {
  root: true,
  task: true,
  iteration: true,
  attempt: true,
  extension: true,
  procedure: true,
};

const extensionSides: KindSet<ExtensionSide> = { before: true, after: true };

const awaitedKinds: KindSet<Awaited["kind"]> = {
  perform: true,
  schema: true,
  retry: true,
};

const itemKeyKinds: KindSet<ItemKey["kind"]> = { event: true, message: true };

export function encodeLink(path: Path, writer: StateWriter): JsonObject {
  switch (path.kind) {
    case "root":
      return { kind: path.kind };
    case "task":
      return encodeTask(path, writer);
    case "iteration": {
      const outer = writer.encodePath(path.outer);
      return { kind: path.kind, outer, index: path.index };
    }
    case "attempt": {
      const outer = writer.encodePath(path.outer);
      return { kind: path.kind, outer, number: path.number };
    }
    case "extension":
      return encodeExtension(path, writer);
    case "procedure": {
      const outer = writer.encodePath(path.outer);
      return { kind: path.kind, outer, reference: path.reference };
    }
  }
}

export function decodeLink(link: JsonObject, decoded: List<Path>): Path {
  const kind = kindAt(link, pathKinds);

  switch (kind) {
    case "root":
      return rootPath;
    case "task":
      return decodeTask(link, decoded);
    case "iteration": {
      const outer = outerAt(link, decoded);
      const index = indexAt(link, "index");
      return iterationPathOf(outer, index);
    }
    case "attempt": {
      const outer = outerAt(link, decoded);
      const number = indexAt(link, "number");
      return attemptPathOf(outer, number);
    }
    case "extension":
      return decodeExtension(link, decoded);
    case "procedure": {
      const outer = outerAt(link, decoded);
      const reference = stringAt(link, "reference");
      return procedurePathOf(outer, reference);
    }
  }
}

export function encodeAwaited(
  awaited: Awaited,
  writer: StateWriter,
): JsonObject {
  const at = writer.encodePath(awaited.at);

  switch (awaited.kind) {
    case "perform": {
      const perform = writer.encodeTerm(awaited.perform);
      return { kind: awaited.kind, at, perform, carried: awaited.carried };
    }
    case "schema":
      return { kind: awaited.kind, at, pointer: awaited.pointer };
    case "retry":
      return { kind: awaited.kind, at };
  }
}

export function awaitedAt(
  encoded: JsonObject,
  key: string,
  reader: StateReader,
): Awaited {
  const awaited = objectAt(encoded, key);
  const kind = kindAt(awaited, awaitedKinds);
  const at = reader.pathAt(awaited, "at");

  switch (kind) {
    case "perform": {
      const performed = performKeyOf(at);
      const perform = reader.formAt(awaited, "perform", "perform");
      const carried = fieldAt(awaited, "carried");
      return performAnswerOf(performed, perform, carried);
    }
    case "schema": {
      const pointer = stringAt(awaited, "pointer");
      return schemaKeyOf(at, pointer);
    }
    case "retry":
      return retryKeyOf(at);
  }
}

export function encodeItemKey(key: ItemKey, writer: StateWriter): JsonObject {
  const at = writer.encodePath(key.at);

  return { kind: key.kind, at, position: key.position };
}

export function itemKeyAt(
  encoded: JsonObject,
  key: string,
  reader: StateReader,
): ItemKey {
  const item = objectAt(encoded, key);
  const kind = kindAt(item, itemKeyKinds);
  const at = reader.pathAt(item, "at");
  const position = indexAt(item, "position");

  switch (kind) {
    case "event":
      return eventKeyOf(at, position);
    case "message":
      return messageKeyOf(at, position);
  }
}

function encodeTask(task: PathOf<"task">, writer: StateWriter): JsonObject {
  const outer = writer.encodePath(task.outer);

  return {
    kind: task.kind,
    outer,
    reference: task.reference,
    visit: task.visit,
  };
}

function encodeExtension(
  extension: PathOf<"extension">,
  writer: StateWriter,
): JsonObject {
  const outer = writer.encodePath(extension.outer);

  return {
    kind: extension.kind,
    outer,
    side: extension.side,
    index: extension.index,
    pointer: extension.pointer,
  };
}

function decodeTask(link: JsonObject, decoded: List<Path>): Path {
  const outer = outerAt(link, decoded);
  const reference = stringAt(link, "reference");
  const visit = indexAt(link, "visit");

  return taskPathOf(outer, reference, visit);
}

function decodeExtension(link: JsonObject, decoded: List<Path>): Path {
  const outer = outerAt(link, decoded);
  const side = ownMemberAt(link, "side", extensionSides);
  const index = indexAt(link, "index");
  const pointer = stringAt(link, "pointer");

  return extensionPathOf(outer, side, { index, pointer });
}

function outerAt(link: JsonObject, decoded: List<Path>): Path {
  const index = indexAt(link, "outer");
  const outer = decoded.get(index);

  if (outer === undefined) {
    throw new InterpreterError(
      `A path of the state extends ${String(index)}, which is not before it.`,
    );
  }

  return outer;
}
