import type { NestedList, Step, StepList } from "language-server/protocol";
import type { Position, Range } from "vscode-languageserver-protocol";

const TRIED = "try";

export interface StepPlace {
  readonly list: string;
  readonly index: number;
  readonly size: number;
}

export function stepsIn(list: StepList): Step[] {
  return list.steps.flatMap(stepsUnder);
}

function stepsUnder(step: Step): Step[] {
  const inner = step.lists.flatMap(stepsIn);
  return [step, ...inner];
}

export function stepWithId(list: StepList, id: string): Step | null {
  return stepsIn(list).find((step) => step.id === id) ?? null;
}

export function stepAt(list: StepList, at: Position): Step | null {
  const holding = stepsIn(list).filter(
    (step) => step.range !== null && contains(step.range, at),
  );
  return holding.at(-1) ?? null;
}

export function placeOf(list: StepList, id: string): StepPlace | null {
  const nested = stepsIn(list).flatMap((step) => step.lists);
  const lists = [list, ...nested];
  const holder = lists.find((each) =>
    each.steps.some((step) => step.id === id),
  );

  if (holder === undefined) return null;

  const index = holder.steps.findIndex((step) => step.id === id);
  return { list: holder.id, index, size: holder.steps.length };
}

export function protectingTryOf(list: StepList, id: string): Step | null {
  const tries = stepsIn(list).filter((step) => step.kind === "try");
  return (
    tries.find((each) => each.lists.some((inner) => holdsOnly(inner, id))) ??
    null
  );
}

function holdsOnly(list: NestedList, id: string): boolean {
  const [only] = list.steps;
  const isAlone = list.steps.length === 1 && only?.id === id;
  return list.part === TRIED && isAlone;
}

function contains(range: Range, at: Position): boolean {
  const { start, end } = range;
  const afterStart =
    at.line > start.line ||
    (at.line === start.line && at.character >= start.character);
  const beforeEnd =
    at.line < end.line ||
    (at.line === end.line && at.character <= end.character);
  return afterStart && beforeEnd;
}
