"use client";

import { FlagIcon } from "lucide-react";
import { IN } from "@/operations/workflow-graph";
import type { CanvasNodeProps } from "./interfaces";
import { Port } from "./node-parts";

export function EndNode({ data }: CanvasNodeProps) {
  return (
    <div className="flex size-full items-center justify-center gap-2 rounded-full border bg-muted text-sm font-medium text-muted-foreground shadow-xs">
      <FlagIcon className="size-4" aria-hidden />
      End
      <Port name={IN} type="target" data={data} />
    </div>
  );
}
