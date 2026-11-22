import {
  type ast,
  flowDirectives,
  type JsonObject,
} from "interpreter/front-end";
import { childPointerOf } from "../pointers/index.js";
import type {
  FailureKind,
  HeldList,
  NamedPlace,
  Retry,
  StepNode,
  StepNodeList,
  StepTree,
} from "./interfaces.js";

const none: readonly HeldList[] = [];

const directiveNames: readonly string[] = flowDirectives;

export function stepTreeOf(workflow: ast.Workflow): StepTree {
  const held: HeldList = { list: workflow.do, part: null, role: "sequence" };
  const root = listNodeOf(held, workflow.do.pointer);
  const lists = listsIn(root);
  const steps = stepsIn(root);
  const stepsByPointer = steps.map((step) => [step.pointer, step] as const);
  const listsByPointer = lists.map((list) => [list.pointer, list] as const);

  return {
    root,
    steps: new Map(stepsByPointer),
    lists: new Map(listsByPointer),
  };
}

export function targetOf(
  tree: StepTree,
  jumps: ReadonlyMap<string, string>,
  directive: string,
): StepNode | null {
  const target = jumps.get(directive);

  if (target === undefined) {
    return null;
  }

  return tree.steps.get(target) ?? null;
}

export function stepHolding(tree: StepTree, pointer: string): StepNode | null {
  const steps = [...tree.steps.values()];
  const holders = steps.filter((step) => {
    const below = `${step.pointer}/`;
    return pointer.startsWith(below);
  });
  const byDepth = holders.toSorted(
    (one, other) => one.pointer.length - other.pointer.length,
  );

  return byDepth.at(-1) ?? null;
}

export function listNamesOf(tree: StepTree, step: StepNode): readonly string[] {
  const list = tree.lists.get(step.list);
  const names = list?.steps.map((sibling) => sibling.name) ?? [];

  return [...new Set(names)];
}

export function nameConflictOf(
  list: StepNodeList,
  name: string,
  renamed: string | null,
): string | null {
  if (name === "") {
    return "A name cannot be empty.";
  }

  const isDirective = directiveNames.includes(name);

  if (isDirective) {
    return `'${name}' is a flow directive, not a name.`;
  }

  const isTaken = list.steps.some(
    (step) => step.pointer !== renamed && step.name === name,
  );

  return isTaken ? `A step named '${name}' already stands in this list.` : null;
}

export function protectedStepOf(step: StepNode): StepNode | null {
  const [body] = step.lists;
  const isTry = step.task.kind === "try";
  const isSole = body?.part === "try" && body.steps.length === 1;

  if (!isTry || !isSole) {
    return null;
  }

  return body.steps[0] ?? null;
}

export function failureOf(step: StepNode): FailureKind {
  const task = step.task;
  const inner = protectedStepOf(step);

  if (task.kind !== "try" || inner === null) {
    return "stop";
  }

  if (task.catch.do !== null) {
    return "handle";
  }

  return task.catch.retry === null ? "continue" : "retry";
}

export function retryCatchOf(retry: Retry): JsonObject {
  const backoff = retry.growing ? "exponential" : "constant";
  const policy = {
    delay: { seconds: retry.seconds },
    backoff: { [backoff]: {} },
    limit: { attempt: { count: retry.retries } },
  };

  return { retry: policy };
}

export function stepWithId(tree: StepTree, id: string): StepNode | null {
  const steps = [...tree.steps.values()];

  return steps.find((step) => step.id === id) ?? null;
}

export function listWithId(tree: StepTree, id: string): StepNodeList | null {
  const lists = [...tree.lists.values()];

  return lists.find((list) => list.id === id) ?? null;
}

export function directiveAt(
  tree: StepTree,
  pointer: string,
): ast.Directive | null {
  const steps = [...tree.steps.values()];
  const directives = steps.flatMap((step) => directivesOf(step.task));

  return directives.find((directive) => directive.pointer === pointer) ?? null;
}

export function stepIdOf(
  listId: string,
  step: NamedPlace,
  earlier: readonly string[],
): string {
  const isBelowRepeat = listId.startsWith("#");
  const isRepeat = earlier.includes(step.name);

  if (isBelowRepeat || isRepeat) {
    return `#${step.pointer}`;
  }

  return childPointerOf(listId, step.name);
}

export function directivesOf(task: ast.Task): readonly ast.Directive[] {
  switch (task.kind) {
    case "switch": {
      const cases = task.switch.map((switchCase) => switchCase.then);
      return [task.then, ...cases];
    }
    case "try": {
      const caught = task.catch.then;
      return caught === null ? [task.then] : [task.then, caught];
    }
    case "call":
    case "do":
    case "emit":
    case "for":
    case "fork":
    case "listen":
    case "raise":
    case "run":
    case "set":
    case "wait":
      return [task.then];
  }
}

function listNodeOf(held: HeldList, id: string): StepNodeList {
  const { list, part, role } = held;
  const names = list.tasks.map((task) => task.name);
  const steps = list.tasks.map((task, index) => {
    const earlier = names.slice(0, index);
    const stepId = stepIdOf(id, task, earlier);
    const lists = nestedListsOf(task).map((nested) => {
      const relative = nested.list.pointer.slice(task.pointer.length);
      return listNodeOf(nested, stepId + relative);
    });

    return {
      id: stepId,
      pointer: task.pointer,
      name: task.name,
      task,
      list: list.pointer,
      index,
      lists,
    };
  });

  return { id, pointer: list.pointer, part, role, steps };
}

function nestedListsOf(task: ast.Task): readonly HeldList[] {
  switch (task.kind) {
    case "do":
      return [{ list: task.do, part: "do", role: "sequence" }];
    case "for":
      return [{ list: task.do, part: "for", role: "sequence" }];
    case "fork":
      return [{ list: task.branches, part: "branches", role: "branches" }];
    case "try": {
      const body: HeldList = { list: task.try, part: "try", role: "sequence" };
      const handler = caughtListsOf(task.catch);
      return [body, ...handler];
    }
    case "listen":
      return iteratedListsOf(task.foreach);
    case "call":
      return subscribedListsOf(task.call);
    case "emit":
    case "raise":
    case "run":
    case "set":
    case "switch":
    case "wait":
      return none;
  }
}

function caughtListsOf(caught: ast.Catch): readonly HeldList[] {
  if (caught.do === null) {
    return none;
  }

  return [{ list: caught.do, part: "catch", role: "sequence" }];
}

function subscribedListsOf(call: ast.Call): readonly HeldList[] {
  const isSubscription =
    call.kind === "asyncapi" && call.exchange.kind === "subscription";

  if (!isSubscription) {
    return none;
  }

  return iteratedListsOf(call.exchange.foreach);
}

function iteratedListsOf(
  iterator: ast.SubscriptionIterator | null,
): readonly HeldList[] {
  const list = iterator?.do ?? null;

  if (list === null) {
    return none;
  }

  return [{ list, part: "foreach", role: "sequence" }];
}

function stepsIn(list: StepNodeList): readonly StepNode[] {
  return list.steps.flatMap((step) => {
    const nested = step.lists.flatMap(stepsIn);
    return [step, ...nested];
  });
}

function listsIn(list: StepNodeList): readonly StepNodeList[] {
  const nested = list.steps.flatMap((step) => step.lists.flatMap(listsIn));

  return [list, ...nested];
}
