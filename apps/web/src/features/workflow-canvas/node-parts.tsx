"use client";

import { Handle, Position } from "@xyflow/react";
import { cn } from "cn";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  NotebookPenIcon,
} from "lucide-react";
import type { Step } from "language-server/protocol";
import { spanOf } from "@/operations/schedule-words";
import { kindInfoOf } from "@/operations/step-kinds";
import {
  type CanvasNode,
  type Direction,
  FAILURE,
  IN,
} from "@/operations/workflow-graph";
import { useCanvas } from "./canvas-context";
import type { CanvasNodeData, StepNodeState } from "./interfaces";
import { TaskTile } from "./task-icon";

const HANDLE = "!size-2.5 !border-2 !border-background !bg-muted-foreground/60";

export const SELECTED = "border-primary ring-2 ring-primary";

export const FLAGGED = "border-destructive ring-2 ring-destructive";

export function Heading({
  step,
  flagged,
  inside = null,
}: {
  readonly step: Step;
  readonly flagged: boolean;
  readonly inside?: number | null;
}) {
  const kind = kindInfoOf(step.kind).label;
  const summary =
    step.kind === "wait" && step.summary !== null
      ? spanOf(step.milliseconds, step.summary)
      : step.summary;
  const line =
    inside === null ? (summary ?? kind) : `${kind}, ${countText(inside)}`;

  return (
    <span className="flex min-w-0 items-center gap-3">
      <TaskTile kind={step.kind} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{step.name}</span>
          {flagged && (
            <CircleAlertIcon
              className="size-3.5 shrink-0 text-destructive"
              aria-label="Has a problem"
            />
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {line}
        </span>
      </span>
    </span>
  );
}

export function useStepNode(step: Step | null): StepNodeState {
  const canvas = useCanvas();
  const id = step?.id ?? null;
  const editing = canvas.editing;
  const kind = step === null ? "" : kindInfoOf(step.kind).label;
  const remove =
    editing === null || id === null
      ? null
      : () => {
          editing.onRemove(id);
        };

  return {
    selected: id !== null && canvas.selected === id,
    flagged: id !== null && canvas.flagged.has(id),
    name: `${step?.name ?? ""}, ${kind}`,
    onKeyDown: (event) => {
      selectOnKeys(
        event,
        () => {
          if (id !== null) canvas.onSelect(id);
        },
        remove,
      );
    },
  };
}

export function StatusSlot({ step }: { readonly step: Step }) {
  const status = useCanvas().status;

  if (status === null) return null;

  return <span className="absolute -top-3 right-3">{status(step)}</span>;
}

export function Note({ text }: { readonly text: string }) {
  return (
    <span
      className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground italic"
      title={text}
    >
      <NotebookPenIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
      <span className="min-w-0 truncate">{text}</span>
    </span>
  );
}

export function Toggle({ node }: { readonly node: CanvasNode }) {
  const canvas = useCanvas();
  const Icon = node.collapsed ? ChevronDownIcon : ChevronUpIcon;
  const label = node.collapsed ? "Show the tasks" : "Hide the tasks";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={!node.collapsed}
      onClick={(event) => {
        event.stopPropagation();
        canvas.onToggle(node.id);
      }}
      className="nodrag flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Icon className="size-4" />
    </button>
  );
}

export function Port({
  name,
  type,
  data,
}: {
  readonly name: string;
  readonly type: "source" | "target";
  readonly data: CanvasNodeData;
}) {
  const canvas = useCanvas();
  const position = positionOf(name, canvas.direction);
  const port = data.ports[name];
  const across = position === Position.Top || position === Position.Bottom;
  const at = port === undefined ? undefined : across ? port.x : port.y;
  const style =
    at === undefined ? undefined : across ? { left: at } : { top: at };

  return (
    <Handle
      type={type}
      position={position}
      id={name}
      className={cn(HANDLE, "!opacity-0")}
      style={style}
      isConnectable={false}
    />
  );
}

export function selectOnKeys(
  event: React.KeyboardEvent,
  select: () => void,
  remove: (() => void) | null,
): void {
  const choosing = event.key === "Enter" || event.key === " ";
  const removing = event.key === "Delete" || event.key === "Backspace";

  if (choosing) {
    event.preventDefault();
    select();
    return;
  }

  if (removing && remove !== null) {
    event.preventDefault();
    remove();
  }
}

function positionOf(name: string, direction: Direction): Position {
  const down = direction === "down";

  if (name === IN) return down ? Position.Top : Position.Left;

  if (name === FAILURE) return down ? Position.Right : Position.Bottom;

  return down ? Position.Bottom : Position.Right;
}

function countText(count: number): string {
  return count === 1 ? "1 task" : `${String(count)} tasks`;
}
