import type { Step, StepList } from "language-server/protocol";
import type { Position, Range } from "vscode-languageserver-protocol";
import type { StepPlace } from "./interfaces";

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

export function stepAt(list: StepList, at: Position): Step | null {
  const holding = stepsIn(list).filter(
    (step) => step.range !== null && contains(step.range, at),
  );
  return holding.at(-1) ?? null;
}

export function placeOf(list: StepList, id: string): StepPlace | null {
  const nested = stepsIn(list).flatMap((step) => step.lists);

  for (const each of [list, ...nested]) {
    const index = each.steps.findIndex((step) => step.id === id);

    if (index >= 0) return { list: each.id, index, size: each.steps.length };
  }

  return null;
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
