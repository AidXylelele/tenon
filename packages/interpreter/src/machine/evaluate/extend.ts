import type { Extend, Extension, TaskList } from "../../core/index.js";
import { InterpreterError } from "../../runtime/index.js";
import { normalSignal } from "../completions/index.js";
import { type Frame, beforeK, sequenceK, stagesK } from "../frames/index.js";
import { type ExtensionSide, extensionPathOf } from "../identity/index.js";
import { Environment, type Here, scopeOf } from "../registers/index.js";
import {
  type Evaluating,
  type Transition,
  evaluating,
  transitionOf,
} from "../transitions/index.js";
import { holds } from "../values/index.js";
import type { View } from "../view.js";

export interface ExtensionPosition {
  readonly extend: Extend;
  readonly applying: readonly number[];
  readonly at: number;
}

interface NoList {
  readonly kind: "none";
}

interface EnteredList {
  readonly kind: "entered";
  readonly evaluating: Evaluating;
}

type ListEntry = NoList | EnteredList;

const noList: NoList = { kind: "none" };

export function evaluateExtend(
  term: Extend,
  here: Here,
  view: View,
): Transition {
  const applying = applyingOf(term, here, view);
  const stages = stagesK({ extend: term, applying, scope: here.scope });
  const start: ExtensionPosition = { extend: term, applying, at: 0 };
  const below = [stages];

  return beforeFrom(start, here, below);
}

export function beforeFrom(
  position: ExtensionPosition,
  here: Here,
  below: readonly Frame[],
): Transition {
  const isPast = position.at === position.applying.length;

  if (isPast) {
    return bodyOf(position.extend, here, below);
  }

  const entry = listEnteredOf(position, "before", here);

  switch (entry.kind) {
    case "none": {
      const next = nextPositionOf(position);
      return beforeFrom(next, here, below);
    }
    case "entered": {
      const frame = beforeK({
        extend: position.extend,
        applying: position.applying,
        at: position.at,
        value: here.value,
        scope: here.scope,
      });
      const frames = [...below, frame];
      return transitionOf(entry.evaluating, frames, []);
    }
  }
}

export function listEnteredOf(
  position: ExtensionPosition,
  side: ExtensionSide,
  here: Here,
): ListEntry {
  const applied = appliedIndexOf(position);
  const extension = extensionAt(position.extend, applied);
  const list = listOf(extension, side);

  if (list === undefined) {
    return noList;
  }

  const index = extension.index;
  const pointer = list.pointer;
  const path = extensionPathOf(here.scope.path, side, { index, pointer });
  const scope = scopeOf(Environment.empty, here.scope.activation, path);
  const listed: Here = { scope, value: here.value };
  const evaluatingList = evaluating(list, listed);

  return { kind: "entered", evaluating: evaluatingList };
}

function applyingOf(term: Extend, here: Here, view: View): readonly number[] {
  const indices = [...term.extensions.keys()];

  return indices.filter((index) => {
    const extension = extensionAt(term, index);
    return holds(extension.conditions, here, view);
  });
}

function bodyOf(
  extend: Extend,
  here: Here,
  below: readonly Frame[],
): Transition {
  const rest = [extend.stages];
  const sequence = sequenceK({
    rest,
    signal: normalSignal,
    scope: here.scope,
  });
  const frames = [...below, sequence];
  const next = evaluating(extend.body, here);

  return transitionOf(next, frames, []);
}

function nextPositionOf(position: ExtensionPosition): ExtensionPosition {
  const at = position.at + 1;

  return { extend: position.extend, applying: position.applying, at };
}

function listOf(
  extension: Extension,
  side: ExtensionSide,
): TaskList | undefined {
  switch (side) {
    case "before":
      return extension.before[0];
    case "after":
      return extension.after[0];
  }
}

function appliedIndexOf(position: ExtensionPosition): number {
  const index = position.applying[position.at];

  if (index === undefined) {
    throw new InterpreterError(
      `No extension applies at ${String(position.at)}.`,
    );
  }

  return index;
}

function extensionAt(extend: Extend, index: number): Extension {
  const extension = extend.extensions[index];

  if (extension === undefined) {
    throw new InterpreterError(
      `An extended task has no extension ${String(index)}.`,
    );
  }

  return extension;
}
