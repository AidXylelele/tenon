import type { NestedList, Step, StepList } from "language-server/protocol";
import { stepsIn } from "@/features/workflow-flow";

const TRIED = "try";

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
