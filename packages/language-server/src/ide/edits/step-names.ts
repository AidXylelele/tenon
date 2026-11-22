import type { StepNodeList } from "../steps/index.js";

export function newNameOf(list: StepNodeList, base: string): string {
  const taken = namesOf(list);
  const isTaken = taken.has(base);

  return isTaken ? numberedNameOf(taken, base, 2) : base;
}

export function copyNameOf(list: StepNodeList, name: string): string {
  const taken = namesOf(list);

  return numberedNameOf(taken, name, 2);
}

function namesOf(list: StepNodeList): ReadonlySet<string> {
  const names = list.steps.map((step) => step.name);

  return new Set(names);
}

function numberedNameOf(
  taken: ReadonlySet<string>,
  base: string,
  numeral: number,
): string {
  const written = String(numeral);
  const candidate = `${base}-${written}`;
  const isTaken = taken.has(candidate);

  return isTaken ? numberedNameOf(taken, base, numeral + 1) : candidate;
}
