'use client';

import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { cn } from 'cn';
import { PlusIcon } from 'lucide-react';
import { useCanvas } from './canvas-context';
import type { CanvasEdge, EdgeKind } from './graph';
import type { PlacedLabel, Point } from './layout';

export type FlowEdgeData = {
  readonly edge: CanvasEdge;
  // The route ELK found, on the canvas, and where it put the edge's labels.
  readonly points: readonly Point[];
  readonly labels: readonly PlacedLabel[];
  readonly taken: boolean;
  readonly live: boolean;
};

type Props = EdgeProps & { readonly data?: FlowEdgeData };

const STROKE: Record<EdgeKind, string> = {
  next: 'var(--edge-neutral)',
  append: 'var(--edge-faint)',
  case: 'var(--edge-choice)',
  jump: 'var(--edge-choice)',
  end: 'var(--edge-neutral)',
  exit: 'var(--edge-neutral)',
  error: 'var(--edge-failure)',
};

const DASHED: ReadonlySet<EdgeKind> = new Set([
  'append',
  'jump',
  'end',
  'exit',
  'error',
]);

const RADIUS = 10;

export function strokeOf(kind: EdgeKind): string {
  return STROKE[kind];
}

// A connection along the route ELK found, its corners rounded, with what it means written on
// it and, while editing, a `+` that adds a step there (research R16).
export function FlowEdge(props: Props) {
  const canvas = useCanvas();
  const data = props.data;

  if (data === undefined || data.points.length < 2) return null;

  const edge = data.edge;
  const path = roundedPath(data.points);
  const stroke = data.taken ? 'var(--edge-taken)' : strokeOf(edge.kind);
  const insertAt = edge.insertAt;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        style={{
          stroke,
          strokeWidth: data.taken ? 2.5 : 1.75,
          strokeDasharray: DASHED.has(edge.kind) ? '6 5' : undefined,
        }}
        className={cn(data.live && 'flow-edge-live')}
        interactionWidth={18}
      />
      <EdgeLabelRenderer>
        {data.labels.map((label) => (
          <div
            key={`${label.role}-${String(label.x)}-${String(label.y)}`}
            className="nodrag nopan absolute flex items-center justify-center"
            style={{
              ...(label.role === 'add'
                ? onTheLine(label, data.points)
                : { left: label.x, top: label.y }),
              width: label.width,
              height: label.height,
              pointerEvents: 'all',
            }}
          >
            {label.role === 'label' && edge.label !== null && (
              <span
                className={cn(
                  'rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shadow-xs',
                  edge.kind === 'case' || edge.kind === 'jump'
                    ? 'border-violet-400/50 text-violet-700 dark:text-violet-300'
                    : edge.kind === 'error'
                      ? 'border-rose-400/50 text-rose-700 dark:text-rose-300'
                      : 'text-muted-foreground',
                )}
              >
                {edge.label}
              </span>
            )}
            {label.role === 'add' && canvas.editable && insertAt !== null && (
              <button
                type="button"
                aria-label="Add a step here"
                onClick={() =>
                  canvas.onInsert(insertAt.listPointer, insertAt.index)
                }
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

// An orthogonal route as an SVG path whose corners are quarter curves.
export function roundedPath(points: readonly Point[]): string {
  const [first, ...rest] = points;

  if (first === undefined) return '';

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

  return commands.join(' ');
}

// ELK keeps a label beside its edge; the `+` sits on the line, at the point nearest the place
// ELK kept for it.
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

// The point `length` away from `from` on the way to `to`.
function towards(from: Point, to: Point, length: number): Point {
  const whole = distance(from, to);

  if (whole === 0) return from;

  const share = length / whole;
  return {
    x: from.x + (to.x - from.x) * share,
    y: from.y + (to.y - from.y) * share,
  };
}
