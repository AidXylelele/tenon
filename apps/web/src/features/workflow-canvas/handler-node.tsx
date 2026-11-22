"use client";

import { ShieldAlertIcon } from "lucide-react";
import { IN, OUT } from "@/operations/workflow-graph";
import type { CanvasNodeProps } from "./interfaces";
import { Port, Toggle } from "./node-parts";

export function HandlerNode({ data }: CanvasNodeProps) {
  const node = data.node;
  const step = node.step;

  if (step === null) return null;

  const line = node.collapsed
    ? `${String(node.inside)} ${node.inside === 1 ? "task runs" : "tasks run"} instead`
    : "These tasks run instead";

  return (
    <div className="relative size-full rounded-3xl border-2 border-dashed border-edge-failure/50 bg-destructive-soft/40">
      <div className="flex items-start gap-2 px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive-soft text-destructive">
          <ShieldAlertIcon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-destructive">
            If {step.name} fails
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {line}
          </span>
        </span>
        <Toggle node={node} />
      </div>
      <Port name={IN} type="target" data={data} />
      <Port name={OUT} type="source" data={data} />
    </div>
  );
}
