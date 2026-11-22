"use client";

import { cn } from "cn";
import { FAILURE, IN, OUT } from "@/operations/workflow-graph";
import type { CanvasNodeProps } from "./interfaces";
import {
  FLAGGED,
  Heading,
  Note,
  Port,
  SELECTED,
  StatusSlot,
  Toggle,
  useStepNode,
} from "./node-parts";

export function GroupNode({ data }: CanvasNodeProps) {
  const node = data.node;
  const step = node.step;
  const { selected, flagged, name, onKeyDown } = useStepNode(step);

  if (step === null) return null;

  return (
    <div
      className={cn(
        "relative size-full rounded-3xl border shadow-xs",
        node.collapsed ? "bg-card" : "bg-muted/40",
        selected && SELECTED,
        flagged && FLAGGED,
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={name}
        onKeyDown={onKeyDown}
        className="flex cursor-pointer flex-col gap-1 rounded-t-3xl px-3 py-2.5 hover:bg-muted/50"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Heading
              step={step}
              flagged={flagged}
              inside={node.collapsed ? node.inside : null}
            />
          </div>
          <Toggle node={node} />
        </div>
        {step.note !== null && <Note text={step.note} />}
      </div>
      <StatusSlot step={step} />
      <Port name={IN} type="target" data={data} />
      <Port name={OUT} type="source" data={data} />
      {node.failing && <Port name={FAILURE} type="source" data={data} />}
    </div>
  );
}
