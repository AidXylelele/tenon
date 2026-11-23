import type { Step, StepList, Transition } from "language-server/protocol";
import type {
  Branch,
  Exit,
  InsertPlace,
  Jump,
  JumpTransition,
  Line,
  ListPlace,
  RunView,
} from "./interfaces";
import { END, plusItemOf, START, stepItemOf } from "./items";

const CONTINUES: Exit = { kind: "next" };
const ENDS: Exit = { kind: "end" };
const LEAVES: Exit = { kind: "exit" };

function doneOf(step: Step): Transition | undefined {
  return step.flow.find((transition) => transition.on === "done");
}

export function continuesOf(step: Step): boolean {
  const done = doneOf(step);
  const goesOn = done?.kind === "next";
  const fallsThrough = goesOn && fallsThroughOf(step);
  const cases = casesOf(step);
  const caseGoesOn = cases.some((transition) => transition.kind === "next");

  return caseGoesOn || fallsThrough;
}

export function doneExitOf(step: Step, list: StepList): Exit | null {
  const done = doneOf(step);

  if (done === undefined || !fallsThroughOf(step)) return null;

  return exitOf(done, list);
}

export function exitOf(transition: Transition, list: StepList): Exit {
  const top = !("part" in list);

  switch (transition.kind) {
    case "next":
      return CONTINUES;
    case "end":
      return ENDS;
    case "exit":
      return top ? ENDS : LEAVES;
    case "jump": {
      const target = list.steps.find((step) => step.id === transition.to);
      const to = target?.id ?? null;
      const name = target?.name ?? null;
      return { kind: "jump", to, name };
    }
  }
}

export function branchesOf(step: Step, list: StepList): readonly Branch[] {
  const cases = casesOf(step);

  return cases.map((transition) => ({
    case: transition.case ?? "",
    when: transition.when,
    exit: exitOf(transition, list),
  }));
}

export function jumpsOf(list: StepList): readonly Jump[] {
  const own = ownJumpsOf(list);
  const nested = list.steps.flatMap((step) => step.lists.flatMap(jumpsOf));

  return [...own, ...nested];
}

export function removalFocusOf(list: StepList, id: string): readonly string[] {
  const index = list.steps.findIndex((step) => step.id === id);

  if (index === -1)
    return list.steps.flatMap((step) =>
      step.lists.flatMap((each) => removalFocusOf(each, id)),
    );

  const above = plusItemOf(list.id, index);
  const neighbours = [list.steps[index - 1], list.steps[index + 1]];
  const steps = neighbours.flatMap((step) =>
    step === undefined ? [] : [stepItemOf(step.id)],
  );

  return [above, ...steps];
}

export function hasStep(list: StepList, id: string): boolean {
  return list.steps.some(
    (step) => step.id === id || step.lists.some((each) => hasStep(each, id)),
  );
}

export function jumpKeyOf(step: string, name: string | null): string {
  if (name === null) return `done:${step}`;

  return `case:${step}:${name}`;
}

export function isSamePlace(
  place: InsertPlace,
  other: InsertPlace | null,
): boolean {
  if (other === null) return false;

  if (place.kind === "list" && other.kind === "list")
    return place.list === other.list && place.index === other.index;

  if (place.kind === "branch" && other.kind === "branch")
    return place.switch === other.switch && place.case === other.case;

  return false;
}

export function lineOf(run: RunView | null, from: string, to: string): Line {
  if (run === null) return "plain";

  const taken = isReached(run, from) && isReached(run, to);
  return taken ? "taken" : "dim";
}

export function isReached(run: RunView, target: string): boolean {
  if (target === START) return true;

  if (target === END) return run.ended;

  return run.steps.has(target);
}

export function isEmptyBlock(step: Step): boolean {
  const held = step.lists.filter((list) => list.part !== "catch");
  const branches = held.flatMap((list) =>
    list.role === "branches" ? list.steps : [],
  );
  const emptyList = held.some((list) => list.steps.length === 0);
  const emptyBranch = branches.some(isEmptyBlock);

  return emptyList || emptyBranch;
}

export function sourcesOf(jumps: readonly Jump[]): ReadonlyMap<string, string> {
  const byTarget = Map.groupBy(jumps, (jump) => jump.to);
  const entries = [...byTarget].map(([to, from]) => {
    const sources = from.map(sourceOf).join(", ");
    return [to, `from ${sources}`] as const;
  });

  return new Map(entries);
}

function sourceOf(jump: Jump): string {
  if (jump.case === null) return jump.fromName;

  return `${jump.fromName} · ${jump.case}`;
}

function casesOf(step: Step): readonly Transition[] {
  return step.flow.filter((transition) => transition.on === "case");
}

function fallsThroughOf(step: Step): boolean {
  const cases = casesOf(step);
  const hasDefault = cases.some((transition) => transition.when === null);

  return !hasDefault;
}

function ownJumpsOf(list: StepList): readonly Jump[] {
  const found = list.steps.flatMap((step) => jumpTransitionsOf(step, list));

  return found.map(({ step, transition, to }, lane) => {
    const key = jumpKeyOf(step.id, transition.case);
    const between = stepsBetweenOf(list, step.id, to);

    return {
      key,
      list: list.id,
      from: step.id,
      fromName: step.name,
      to,
      between,
      lane,
      case: transition.case,
    };
  });
}

function jumpTransitionsOf(
  step: Step,
  list: StepList,
): readonly JumpTransition[] {
  const done = doneOf(step);
  const followed = fallsThroughOf(step) && done !== undefined ? [done] : [];
  const leaving = [...casesOf(step), ...followed].filter(
    (transition) => transition.kind === "jump",
  );

  return leaving.flatMap((transition) => {
    const target = list.steps.find((each) => each.id === transition.to);

    if (target === undefined) return [];

    return [{ step, transition, to: target.id }];
  });
}

function stepsBetweenOf(
  list: StepList,
  from: string,
  to: string,
): readonly string[] {
  const ids = list.steps.map((step) => step.id);
  const start = ids.indexOf(from);
  const end = ids.indexOf(to);
  const first = Math.min(start, end);
  const last = Math.max(start, end);

  return ids.slice(first, last + 1);
}

export function stepsIn(list: StepList): Step[] {
  return list.steps.flatMap(stepsUnder);
}

export function stepsUnder(step: Step): Step[] {
  const inner = step.lists.flatMap(stepsIn);
  return [step, ...inner];
}

export function stepWithId(list: StepList, id: string): Step | null {
  return stepsIn(list).find((step) => step.id === id) ?? null;
}

export function placeOf(list: StepList, id: string): ListPlace | null {
  const nested = stepsIn(list).flatMap((step) => step.lists);

  for (const each of [list, ...nested]) {
    const index = each.steps.findIndex((step) => step.id === id);

    if (index >= 0) return { list: each.id, index, size: each.steps.length };
  }

  return null;
}
