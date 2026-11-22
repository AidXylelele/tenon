import type { ast, JsonValue } from "interpreter/front-end";
import { jqStringOf, runtimeExpressionOf } from "../jq-text/index.js";
import { childPointerOf, valueAt } from "../pointers/index.js";
import type { StepNode, StepTree } from "../steps/index.js";

const exportedName = /^\$\{ \$context \+ \{ ("(?:[^"\\]|\\.)*"): \. \} \}$/;

export function exportAsOf(name: string): string {
  const key = jqStringOf(name);
  const added = `$context + { ${key}: . }`;

  return runtimeExpressionOf(added);
}

export function exportAsPointerOf(pointer: string): string {
  const exported = childPointerOf(pointer, "export");

  return childPointerOf(exported, "as");
}

export function exportedNameOf(written: JsonValue | undefined): string | null {
  if (typeof written !== "string") {
    return null;
  }

  const found = exportedName.exec(written);
  const key = found?.[1];

  if (key === undefined) {
    return null;
  }

  const name: unknown = JSON.parse(key);
  const isName = typeof name === "string";

  return isName ? name : null;
}

export function exportersOf(
  tree: StepTree,
  document: JsonValue,
  name: string,
): readonly StepNode[] {
  const steps = [...tree.steps.values()];

  return steps.filter((step) => exportedKeyOf(document, step) === name);
}

export function replacesContextOf(
  document: JsonValue,
  step: StepNode,
): boolean {
  const pointer = exportAsPointerOf(step.pointer);
  const written = valueAt(document, pointer);
  const key = exportedNameOf(written);
  const isForeign = written !== undefined && key !== step.name;
  const iterators = iteratorsOf(step.task);
  const isIterated = iterators.some((iterator) =>
    isExportWrittenOf(document, iterator.export),
  );
  const nested = step.lists.flatMap((list) => list.steps);
  const isNested = nested.some((inner) => replacesContextOf(document, inner));

  return isForeign || isIterated || isNested;
}

function exportedKeyOf(document: JsonValue, step: StepNode): string | null {
  const pointer = exportAsPointerOf(step.pointer);
  const written = valueAt(document, pointer);

  return exportedNameOf(written);
}

function isExportWrittenOf(document: JsonValue, exported: ast.Export): boolean {
  const pointer = childPointerOf(exported.pointer, "as");

  return valueAt(document, pointer) !== undefined;
}

function iteratorsOf(task: ast.Task): readonly ast.SubscriptionIterator[] {
  const iterator = iteratorOf(task);

  return iterator === null ? [] : [iterator];
}

function iteratorOf(task: ast.Task): ast.SubscriptionIterator | null {
  if (task.kind === "listen") {
    return task.foreach;
  }

  const call = task.kind === "call" ? task.call : null;
  const isSubscription =
    call?.kind === "asyncapi" && call.exchange.kind === "subscription";

  if (!isSubscription) {
    return null;
  }

  return call.exchange.foreach;
}
