"use client";

import { PlusIcon } from "lucide-react";
import { IN } from "@/operations/workflow-graph";
import { useCanvas } from "./canvas-context";
import type { CanvasNodeProps } from "./interfaces";
import { Port } from "./node-parts";

export function AddNode({ data }: CanvasNodeProps) {
  const canvas = useCanvas();
  const place = data.node.addTo;
  const editing = canvas.editing;

  if (place === null || editing === null) return null;

  return (
    <button
      type="button"
      onClick={() => {
        editing.onInsert(place);
      }}
      className="flex size-full items-center justify-center gap-1.5 rounded-full border border-dashed border-primary/40 bg-background text-xs font-medium text-accent-text transition-colors hover:border-primary hover:bg-primary/5"
    >
      <PlusIcon className="size-3.5" aria-hidden />
      Add task
      <Port name={IN} type="target" data={data} />
    </button>
  );
}
