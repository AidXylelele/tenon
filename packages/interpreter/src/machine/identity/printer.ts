import type { EffectId } from "../../api/index.js";
import {
  childPointerOf,
  relativePointerOf,
  rootPointer,
} from "../../runtime/index.js";
import type { EffectKey } from "./effect-keys.js";
import type { ExtensionSide, Path, PathOf } from "./paths.js";

const visitMarker = "~";
const attemptMarker = "#";
const procedureMarker = "@function";
const beforeMarker = "@before";
const afterMarker = "@after";
const schemaMarker = "@";
const retryMarker = "@retry";
const eventMarker = "@event";
const messageMarker = "@message";

interface Printed {
  readonly execution: string;
  readonly reference: string;
}

const rootPrinted: Printed = { execution: "", reference: rootPointer };

export function executionOf(path: Path): string {
  const printed = printedOf(path);

  return printed.execution;
}

export function effectIdOf(key: EffectKey): EffectId {
  switch (key.kind) {
    case "perform":
      return executionOf(key.at);
    case "schema": {
      const at = printedOf(key.at);
      const steps = relativePointerOf(at.reference, key.pointer);
      return `${at.execution}${schemaMarker}${steps}`;
    }
    case "retry": {
      const execution = executionOf(key.at);
      return `${execution}${retryMarker}`;
    }
    case "event": {
      const execution = executionOf(key.at);
      const position = positionMarkerOf(key.position);
      return `${execution}${eventMarker}${position}`;
    }
    case "message": {
      const execution = executionOf(key.at);
      const position = positionMarkerOf(key.position);
      return `${execution}${messageMarker}${position}`;
    }
  }
}

function printedOf(path: Path): Printed {
  const links = linksOf(path);

  return links.reduce(markedBy, rootPrinted);
}

function linksOf(path: Path): readonly Path[] {
  const inward: Path[] = [];

  for (let link = path; link.kind !== "root"; link = link.outer) {
    inward.push(link);
  }

  return inward.toReversed();
}

function markedBy(printed: Printed, link: Path): Printed {
  switch (link.kind) {
    case "root":
      return printed;
    case "task":
      return taskMarked(printed, link);
    case "iteration": {
      const position = positionMarkerOf(link.index);
      const execution = `${printed.execution}${position}`;
      return { execution, reference: printed.reference };
    }
    case "attempt": {
      const attempt = String(link.number);
      const execution = `${printed.execution}${attemptMarker}${attempt}`;
      return { execution, reference: printed.reference };
    }
    case "extension":
      return extensionMarked(printed, link);
    case "procedure": {
      const execution = `${printed.execution}${procedureMarker}`;
      return { execution, reference: link.reference };
    }
  }
}

function taskMarked(printed: Printed, task: PathOf<"task">): Printed {
  const steps = relativePointerOf(printed.reference, task.reference);
  const visit = visitMarkerOf(task.visit);
  const execution = `${printed.execution}${steps}${visit}`;

  return { execution, reference: task.reference };
}

function extensionMarked(
  printed: Printed,
  extension: PathOf<"extension">,
): Printed {
  const side = extensionMarkerOf(extension.side);
  const lists = `${printed.execution}${side}`;
  const execution = childPointerOf(lists, extension.index);

  return { execution, reference: extension.pointer };
}

function positionMarkerOf(position: number): string {
  return `[${String(position)}]`;
}

function visitMarkerOf(visit: number): string {
  if (visit === 1) {
    return "";
  }

  return `${visitMarker}${String(visit)}`;
}

function extensionMarkerOf(side: ExtensionSide): string {
  switch (side) {
    case "before":
      return beforeMarker;
    case "after":
      return afterMarker;
  }
}
