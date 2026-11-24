import { type TaskKind, extensionTargetsOf } from "../../standard/index.js";
import type * as ast from "../../syntax/index.js";
import {
  type Expression,
  type Extension,
  extension as extensionTerm,
} from "../forms/index.js";
import { inputFrame } from "../storage/index.js";
import type { Context } from "./context.js";
import { taskListsOf } from "./do.js";
import { conditionsOf } from "./expressions.js";

export type ExtensionTerms = ReadonlyMap<ast.Extension, Extension>;

type ExtensionEntry = readonly [ast.Extension, Extension];

const noExtensions: readonly Extension[] = [];

export function extensionTermsOf(
  use: ast.Use,
  context: Context,
): ExtensionTerms {
  const entries = use.extensions.map((extension, index) =>
    entryOf(extension, index, context),
  );

  return new Map(entries);
}

export function applyingOf(
  task: ast.Task,
  context: Context,
): readonly Extension[] {
  switch (context.extending) {
    case "extended":
      return extendingOf(task.kind, context.extensions);
    case "unextended":
      return noExtensions;
  }
}

function entryOf(
  extension: ast.Extension,
  index: number,
  context: Context,
): ExtensionEntry {
  const term = extensionTermOf(extension, index, context);
  return [extension, term];
}

function extensionTermOf(
  extension: ast.Extension,
  index: number,
  context: Context,
): Extension {
  const id = context.termIdOf(extension.pointer, "extend");
  const conditions = whenOf(extension.when, context);
  const listed = context.unextended().transparent();
  const before = taskListsOf(extension.before, listed);
  const after = taskListsOf(extension.after, listed);

  return extensionTerm({ id, index, conditions, before, after });
}

function whenOf(
  when: ast.Expression | null,
  context: Context,
): readonly Expression[] {
  const extended = context.entered("own").extended(inputFrame);
  return conditionsOf(when, extended);
}

function extendingOf(
  kind: TaskKind,
  extensions: ExtensionTerms,
): readonly Extension[] {
  const targets = extensionTargetsOf(kind);
  const declared = [...extensions];
  const applying = declared.filter(([written]) =>
    targets.includes(written.extend),
  );

  return applying.map(([, term]) => term);
}
