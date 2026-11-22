"use client";

import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { cn } from "@/libs/ui/tokens/cn";
import { PlusIcon } from "lucide-react";
import type { EdgeKind, PlacedLabel, Point } from "@/operations/workflow-graph";
import { useCanvas } from "./canvas-context";
import type { FlowEdgeData } from "./interfaces";

type Props = EdgeProps & { readonly data?: FlowEdgeData };

const STROKE: Record<EdgeKind, string> = {
  next: "var(--edge)",
  append: "var(--edge)",
  case: "var(--edge-choice)",
  jump: "var(--edge-choice)",
  end: "var(--edge)",
  exit: "var(--edge)",
  error: "var(--edge-failure)",
};

const DASHED: ReadonlySet<EdgeKind> = new Set([
  "append",
  "jump",
  "end",
  "exit",
  "error",
]);

const RADIUS = 10;

export function strokeOf(kind: EdgeKind): string {
  return STROKE[kind];
}

export function FlowEdge(props: Props) {
  const editing = useCanvas().editing;
  const data = props.data;

  if (data === undefined || data.points.length < 2) return null;

  const edge = data.edge;
  const path = roundedPath(data.points);
  const stroke = strokeOf(edge.kind);
  const dashes = DASHED.has(edge.kind) ? "6 5" : undefined;
  const insertAt = edge.insertAt;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        style={{ stroke, strokeWidth: 1.75, strokeDasharray: dashes }}
        interactionWidth={18}
      />
      <EdgeLabelRenderer>
        {data.labels.map((label) => (
          <div
            key={`${label.role}-${String(label.x)}-${String(label.y)}`}
            className="nodrag nopan absolute flex items-center justify-center"
            style={{
              ...(label.role === "add"
                ? onTheLine(label, data.points)
                : { left: label.x, top: label.y }),
              width: label.width,
              height: label.height,
              pointerEvents: "all",
            }}
          >
            {label.role === "label" && edge.label !== null && (
              <span
                className={cn(
                  "rounded-full border bg-background px-2 py-0.5 text-xs font-medium whitespace-nowrap shadow-xs",
                  edge.kind === "case" || edge.kind === "jump"
                    ? "border-edge-choice/50 text-edge-choice"
                    : edge.kind === "error"
                      ? "border-edge-failure/50 text-edge-failure"
                      : "text-muted-foreground",
                )}
              >
                {edge.label}
              </span>
            )}
            {label.role === "add" && editing !== null && insertAt !== null && (
              <button
                type="button"
                aria-label="Add a task here"
                onClick={() => {
                  editing.onInsert(insertAt);
                }}
                className="flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs transition hover:scale-110 hover:border-primary hover:text-primary"
              >
                <PlusIcon className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </EdgeLabelRenderer>
    </>
  );
}

function roundedPath(points: readonly Point[]): string {
  const [first, ...rest] = points;

  if (first === undefined) return "";

  const commands = [`M ${String(first.x)} ${String(first.y)}`];

  rest.forEach((point, index) => {
    const before = points[index];
    const after = rest[index + 1];

    if (before === undefined || after === undefined) {
      commands.push(`L ${String(point.x)} ${String(point.y)}`);
      return;
    }

    const into = Math.min(RADIUS, distance(before, point) / 2);
    const out = Math.min(RADIUS, distance(point, after) / 2);
    const start = towards(point, before, into);
    const end = towards(point, after, out);
    commands.push(`L ${String(start.x)} ${String(start.y)}`);
    commands.push(
      `Q ${String(point.x)} ${String(point.y)} ${String(end.x)} ${String(end.y)}`,
    );
  });

  return commands.join(" ");
}

function onTheLine(
  label: PlacedLabel,
  points: readonly Point[],
): { readonly left: number; readonly top: number } {
  const centre = {
    x: label.x + label.width / 2,
    y: label.y + label.height / 2,
  };
  let nearest = points[0] ?? centre;

  for (let at = 1; at < points.length; at += 1) {
    const from = points[at - 1];
    const to = points[at];

    if (from === undefined || to === undefined) continue;

    const candidate = closestOn(from, to, centre);

    if (distance(candidate, centre) < distance(nearest, centre))
      nearest = candidate;
  }

  return {
    left: nearest.x - label.width / 2,
    top: nearest.y - label.height / 2,
  };
}

function closestOn(from: Point, to: Point, point: Point): Point {
  const length = distance(from, to);

  if (length === 0) return from;

  const along =
    ((point.x - from.x) * (to.x - from.x) +
      (point.y - from.y) * (to.y - from.y)) /
    (length * length);
  const share = Math.min(1, Math.max(0, along));
  return {
    x: from.x + (to.x - from.x) * share,
    y: from.y + (to.y - from.y) * share,
  };
}

function distance(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function towards(from: Point, to: Point, length: number): Point {
  const whole = distance(from, to);

  if (whole === 0) return from;

  const share = length / whole;
  return {
    x: from.x + (to.x - from.x) * share,
    y: from.y + (to.y - from.y) * share,
  };
}
