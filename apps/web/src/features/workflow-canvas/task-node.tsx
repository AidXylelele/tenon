"use client";

import { cn } from "@/libs/ui/tokens/cn";
import { CASE, FAILURE, IN, OUT } from "@/operations/workflow-graph";
import type { CanvasNodeProps } from "./interfaces";
import {
  FLAGGED,
  Heading,
  Note,
  Port,
  SELECTED,
  StatusSlot,
  useStepNode,
} from "./node-parts";

export function TaskNode({ data }: CanvasNodeProps) {
  const node = data.node;
  const step = node.step;
  const { selected, flagged, name, onKeyDown } = useStepNode(step);

  if (step === null) return null;

  const defaulted = node.cases.some((each) => each.when === null);
  const flows = step.kind !== "raise" && !defaulted;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={name}
      onKeyDown={onKeyDown}
      className={cn(
        "group relative flex size-full cursor-pointer flex-col justify-center gap-1 rounded-2xl border bg-card px-3 py-2.5 shadow-xs transition-shadow hover:shadow-md",
        selected && SELECTED,
        flagged && FLAGGED,
      )}
    >
      <Heading step={step} flagged={flagged} />
      <StatusSlot step={step} />
      {step.note !== null && <Note text={step.note} />}
      <Port name={IN} type="target" data={data} />
      {node.cases.map((each) => (
        <Port
          key={each.index}
          name={`${CASE}${String(each.index)}`}
          type="source"
          data={data}
        />
      ))}
      {flows && <Port name={OUT} type="source" data={data} />}
      {node.failing && <Port name={FAILURE} type="source" data={data} />}
    </div>
  );
}
