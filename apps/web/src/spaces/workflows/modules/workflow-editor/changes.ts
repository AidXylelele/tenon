import type { Step, StepList } from "language-server/protocol";
import { stepsIn } from "@/features/workflow-flow";
import type { StepChange } from "./interfaces";

export function changesOf(before: StepList, after: StepList): StepChange[] {
  const old = stepsIn(before);
  const now = stepsIn(after);
  const added = now.filter((step) => namedIn(old, step) === null);
  const removed = old.filter((step) => namedIn(now, step) === null);
  const changed = now.filter((step) => {
    const was = namedIn(old, step);
    return was !== null && !isSame(was, step);
  });
  return [
    ...added.map((step) => changeOf(step, "added")),
    ...changed.map((step) => changeOf(step, "changed")),
    ...removed.map((step) => changeOf(step, "removed")),
  ];
}

function namedIn(steps: readonly Step[], step: Step): Step | null {
  return steps.find((each) => each.id === step.id) ?? null;
}

function isSame(one: Step, other: Step): boolean {
  const flows = JSON.stringify(one.flow) === JSON.stringify(other.flow);
  return (
    one.summary === other.summary && one.variant === other.variant && flows
  );
}

function changeOf(step: Step, kind: StepChange["kind"]): StepChange {
  return { id: step.id, name: step.name, kind };
}
