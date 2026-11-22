import type { ast } from "interpreter/front-end";
import { childPointerOf } from "../pointers/index.js";
import { modelOf } from "../snapshot/index.js";
import {
  directivesOf,
  nameConflictOf,
  type StepNode,
  type StepNodeList,
  stepWithId,
} from "../steps/index.js";
import { dedentedOf, indentedOf } from "../text/index.js";
import { startingContentOf } from "../variants/index.js";
import { inlineYamlOf, yamlOf } from "../yaml-text/index.js";
import { changeOf, editedSliceOf, listTextOf } from "./collection-text.js";
import { combinedOf } from "./edits.js";
import { fieldSettingOf } from "./field-actions.js";
import { idChangesOf, placedStepOf } from "./ids.js";
import type {
  CollectionText,
  Editable,
  Editing,
  IdChange,
  Redirection,
  Redirections,
  Run,
  SetField,
  Span,
  WrapBlock,
  RunWrapping,
  WrapSteps,
} from "./interfaces.js";
import { unknownStepOf } from "./step-actions.js";

const kept: Redirection = { kind: "kept" };

const blockLists: Readonly<Record<WrapBlock, string>> = {
  do: "do",
  for: "do",
  try: "try",
};

const noJumps: ReadonlyMap<string, string> = new Map();

const adjoining =
  "The steps to wrap do not stand next to each other in one list.";

const forked = "Branches of a fork run at once; wrap one branch at a time.";

export function wrappingOf(editable: Editable, action: WrapSteps): Editing {
  const steps = action.steps.map((id) => stepWithId(editable.tree, id));
  const known = steps.filter((step) => step !== null);
  const unknown = action.steps.find((_, index) => steps[index] === null);
  const [first] = known;

  if (unknown !== undefined) {
    return { kind: "refused", reason: unknownStepOf(unknown) };
  }

  if (first === undefined) {
    return { kind: "refused", reason: "Choose at least one step to wrap." };
  }

  const list = editable.tree.lists.get(first.list);
  const isAdjoining = list !== undefined && isRunOf(list, known);

  if (list === undefined || !isAdjoining) {
    return { kind: "refused", reason: adjoining };
  }

  const name = action.name ?? first.name;
  const run = { list, steps: known, name };
  return runWrappingOf(editable, run, action.block);
}

function runWrappingOf(
  editable: Editable,
  run: Run,
  block: WrapBlock,
): Editing {
  const [first] = run.steps;
  const renamed = first?.pointer ?? null;
  const conflict = nameConflictOf(run.list, run.name, renamed);
  const isForked = run.list.role === "branches" && run.steps.length > 1;

  if (isForked) {
    return { kind: "refused", reason: forked };
  }

  if (conflict !== null) {
    return { kind: "refused", reason: conflict };
  }

  const wrapping = runWrappingFor(editable, run, block);
  const inner = run.steps.flatMap((step) =>
    innerRedirectionsOf(wrapping, step),
  );
  const others = run.list.steps.filter((step) => !run.steps.includes(step));
  const outer = others.flatMap((step) => outerRedirectionsOf(wrapping, step));
  const refusal = [...inner, ...outer].find((each) => each.kind === "refused");

  if (refusal?.kind === "refused") {
    return { kind: "refused", reason: refusal.reason };
  }

  const settings = {
    inner: inner.flatMap(settingsOf),
    outer: outer.flatMap(settingsOf),
  };
  return wrappedOf(editable, wrapping, settings);
}

function runWrappingFor(
  editable: Editable,
  run: Run,
  block: WrapBlock,
): RunWrapping {
  const model = modelOf(editable.snapshot);
  const jumps = model?.symbols.jumps ?? noJumps;
  const last = run.steps.at(-1);
  const after = last === undefined ? null : run.list.steps[last.index + 1];
  const isWorkflowList = run.list === editable.tree.root;

  return { run, block, jumps, after: after ?? null, isWorkflowList };
}

function wrappedOf(
  editable: Editable,
  wrapping: RunWrapping,
  settings: Redirections,
): Editing {
  const collection = listTextOf(editable, wrapping.run.list);

  if (collection === null) {
    return { kind: "refused", reason: adjoining };
  }

  const inside = settings.inner.map((each) => fieldSettingOf(editable, each));
  const rewritten = combinedOf(inside);

  if (rewritten.kind === "refused") {
    return rewritten;
  }

  const span = spanOf(collection, wrapping.run);
  const items = editedSliceOf(editable.text, span, rewritten.changes);
  const blockText = blockTextOf(collection, wrapping, items);
  const replacement = changeOf(editable.text, span, blockText);
  const replaced: Editing = { kind: "edited", changes: [replacement], ids: [] };
  const outside = settings.outer.map((each) => fieldSettingOf(editable, each));
  const combined = combinedOf([...outside, replaced]);

  if (combined.kind === "refused") {
    return combined;
  }

  const ids = movedIdsOf(wrapping);
  return { ...combined, ids };
}

function innerRedirectionsOf(
  wrapping: RunWrapping,
  step: StepNode,
): readonly Redirection[] {
  const directives = directivesOf(step.task);

  return directives.map((directive) =>
    innerRedirectionOf(wrapping, step, directive),
  );
}

function innerRedirectionOf(
  wrapping: RunWrapping,
  step: StepNode,
  directive: ast.Directive,
): Redirection {
  switch (directive.kind) {
    case "continue":
    case "end":
      return kept;
    case "exit":
      return exitRedirectionOf(wrapping, step, directive);
    case "label":
      return innerJumpOf(wrapping, step, directive);
  }
}

function exitRedirectionOf(
  wrapping: RunWrapping,
  step: StepNode,
  directive: ast.Directive,
): Redirection {
  if (!wrapping.isWorkflowList) {
    const reason = `The step ${step.id} leaves its list, which inside the block would leave only the block.`;
    return { kind: "refused", reason };
  }

  return redirectedOf(directive, "end");
}

function innerJumpOf(
  wrapping: RunWrapping,
  step: StepNode,
  directive: ast.LabelDirective,
): Redirection {
  const target = wrapping.jumps.get(directive.pointer);
  const isWrapped = wrapping.run.steps.some((each) => each.pointer === target);
  const isAfter = target === wrapping.after?.pointer;
  const isLeft = isAfter && wrapping.block !== "for";

  if (isWrapped) {
    return kept;
  }

  if (isLeft) {
    return redirectedOf(directive, "exit");
  }

  const reason = `The step ${step.id} goes to '${directive.name}', outside the block, which a step inside it cannot do.`;
  return { kind: "refused", reason };
}

function outerRedirectionsOf(
  wrapping: RunWrapping,
  step: StepNode,
): readonly Redirection[] {
  const directives = directivesOf(step.task);

  return directives.map((directive) =>
    outerRedirectionOf(wrapping, step, directive),
  );
}

function outerRedirectionOf(
  wrapping: RunWrapping,
  step: StepNode,
  directive: ast.Directive,
): Redirection {
  if (directive.kind !== "label") {
    return kept;
  }

  const { run } = wrapping;
  const [first] = run.steps;
  const target = wrapping.jumps.get(directive.pointer);
  const wrapped = run.steps.find((each) => each.pointer === target);
  const isFirst = wrapped === first;

  if (wrapped === undefined) {
    return kept;
  }

  if (!isFirst) {
    const reason = `The step ${step.id} goes to '${directive.name}', which would stand inside the block; only its first step can be gone to.`;
    return { kind: "refused", reason };
  }

  const isRenamed = run.name !== wrapped.name;

  if (!isRenamed) {
    return kept;
  }

  return redirectedOf(directive, run.name);
}

function redirectedOf(directive: ast.Directive, value: string): Redirection {
  const setting: SetField = {
    kind: "setField",
    pointer: directive.pointer,
    value,
  };

  return { kind: "set", setting };
}

function settingsOf(redirection: Redirection): readonly SetField[] {
  switch (redirection.kind) {
    case "set":
      return [redirection.setting];
    case "kept":
    case "refused":
      return [];
  }
}

function blockTextOf(
  collection: CollectionText,
  wrapping: RunWrapping,
  items: string,
): string {
  const { block, run } = wrapping;
  const content = startingContentOf(block);
  const member = blockLists[block];
  const emptied = { ...content, [member]: [] };
  const holder = { [run.name]: emptied };

  switch (collection.kind) {
    case "block": {
      const shell = yamlOf([holder]);
      const inner = dedentedOf(items, collection.indent);
      const listed = indentedOf(inner, 6);
      const filled = shell.replace(
        `    ${member}: []\n`,
        `    ${member}:\n${listed}`,
      );
      return indentedOf(filled, collection.indent);
    }
    case "flow": {
      const shell = inlineYamlOf(holder);
      return shell.replace(`${member}: []`, `${member}: [ ${items} ]`);
    }
  }
}

function spanOf(collection: CollectionText, run: Run): Span {
  const [first] = run.steps;
  const last = run.steps.at(-1);
  const start = collection.items[first?.index ?? 0];
  const end = collection.items[last?.index ?? 0];
  const from = start?.start ?? 0;
  const to = end?.end ?? from;

  return { start: from, end: to };
}

function movedIdsOf(wrapping: RunWrapping): readonly IdChange[] {
  const { run, block } = wrapping;
  const [first] = run.steps;
  const names = run.list.steps.map((step) => step.name);
  const earlier = names.slice(0, first?.index ?? 0);
  const placed = placedStepOf(run.list, run.name, earlier);
  const member = blockLists[block];
  const inner = {
    id: `${placed.id}/${member}`,
    pointer: childPointerOf(placed.pointer, member),
  };
  const wrappedNames = run.steps.map((step) => step.name);

  return run.steps.flatMap((step, index) => {
    const before = wrappedNames.slice(0, index);
    const moved = placedStepOf(inner, step.name, before);
    return idChangesOf(step, moved);
  });
}

function isRunOf(list: StepNodeList, steps: readonly StepNode[]): boolean {
  const [first] = steps;
  const start = first?.index ?? 0;

  return steps.every(
    (step, offset) =>
      step.list === list.pointer && step.index === start + offset,
  );
}
