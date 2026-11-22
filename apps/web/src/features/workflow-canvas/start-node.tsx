"use client";

import { cn } from "cn";
import { CalendarClockIcon, HandIcon, RadioIcon } from "lucide-react";
import { triggerText } from "@/operations/schedule-words";
import { OUT, START } from "@/operations/workflow-graph";
import { useCanvas } from "./canvas-context";
import type { CanvasNodeProps } from "./interfaces";
import { FLAGGED, Port, SELECTED, selectOnKeys } from "./node-parts";

export function StartNode({ data }: CanvasNodeProps) {
  const canvas = useCanvas();
  const triggers = canvas.triggers;
  const pickable = canvas.editing !== null;
  const selected = canvas.selected === START;
  const flagged = canvas.flagged.has(START);
  const byEvent = triggers.some((trigger) => trigger.kind === "on");
  const Icon =
    triggers.length === 0 ? HandIcon : byEvent ? RadioIcon : CalendarClockIcon;
  const written =
    triggers.length === 0
      ? "By hand, or when an application starts it"
      : triggers.map(triggerText).join("; ");
  const line = canvas.startLine ?? written;

  return (
    <div
      role={pickable ? "button" : undefined}
      tabIndex={pickable ? 0 : undefined}
      aria-pressed={pickable ? selected : undefined}
      aria-label={pickable ? "Start" : undefined}
      onKeyDown={
        pickable
          ? (event) => {
              selectOnKeys(
                event,
                () => {
                  canvas.onSelect(START);
                },
                null,
              );
            }
          : undefined
      }
      className={cn(
        "flex size-full min-w-0 flex-col justify-center gap-1 overflow-hidden rounded-2xl border bg-card px-3 text-left shadow-xs",
        pickable && "cursor-pointer",
        selected && SELECTED,
        flagged && FLAGGED,
      )}
    >
      <span className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Start</span>
          <span className="line-clamp-2 block text-xs leading-snug text-muted-foreground">
            {line}
          </span>
        </span>
      </span>
      <Port name={OUT} type="source" data={data} />
    </div>
  );
}
