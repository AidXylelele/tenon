'use client';

import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import { cn } from 'cn';
import { PlusIcon } from 'lucide-react';
import { useCanvas } from './canvas-context';
import type { CanvasEdge } from './graph';

export type FlowEdgeData = {
  readonly edge: CanvasEdge;
  readonly taken: boolean;
  readonly live: boolean;
};

type Props = EdgeProps & { readonly data?: FlowEdgeData };

const STROKE: Record<CanvasEdge['kind'], string> = {
  next: 'var(--edge-neutral)',
  append: 'var(--edge-faint)',
  case: 'var(--edge-choice)',
  jump: 'var(--edge-choice)',
  end: 'var(--edge-neutral)',
};

// A connection between steps. The next step is a curve; a jump or a case that skips steps
// arcs over the line, forward above and backward below, so it never crosses a step; a label
// says what the connection means, and while editing a `+` on it adds a step there.
export function FlowEdge(props: Props) {
  const canvas = useCanvas();
  const edge = props.data?.edge;
  const taken = props.data?.taken === true;
  const live = props.data?.live === true;

  if (edge === undefined) return null;

  const [path, labelX, labelY, skips] = pathOf(props, edge);
  // A case names itself at its handle on the choice; its edge repeats the name only when it
  // skips steps, where the handle is far away.
  const label = edge.kind === 'case' && !skips ? null : edge.label;
  const dashed =
    edge.kind === 'jump' || edge.kind === 'end' || edge.kind === 'append';
  const stroke = taken ? 'var(--edge-taken)' : STROKE[edge.kind];
  const insertAt = edge.insertAt;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        style={{
          stroke,
          strokeWidth: taken ? 2.5 : 1.75,
          strokeDasharray: dashed ? '6 5' : undefined,
        }}
        className={cn(live && 'flow-edge-live')}
        interactionWidth={18}
      />
      {(label !== null || (canvas.editable && insertAt !== null)) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute flex items-center gap-1"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            {label !== null && (
              <span
                className={cn(
                  'rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium whitespace-nowrap shadow-xs',
                  edge.kind === 'case' || edge.kind === 'jump'
                    ? 'border-violet-400/50 text-violet-700 dark:text-violet-300'
                    : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            )}
            {canvas.editable && insertAt !== null && (
              <button
                type="button"
                aria-label="Add a step here"
                onClick={() =>
                  canvas.onInsert(insertAt.listPointer, insertAt.index)
                }
                className="flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-70 shadow-xs transition hover:scale-110 hover:border-primary hover:text-primary hover:opacity-100"
              >
                <PlusIcon className="size-3.5" />
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function pathOf(
  props: Props,
  edge: CanvasEdge,
): [string, number, number, boolean] {
  const { sourceX, sourceY, targetX, targetY } = props;
  const skips =
    edge.kind === 'jump' ||
    edge.kind === 'end' ||
    (edge.kind === 'case' && Math.abs(targetX - sourceX) > 200);

  if (!skips) {
    const [path, x, y] = getBezierPath(props);
    return [path, x, y, false];
  }

  const forward = targetX > sourceX;
  // High enough to clear a container's header between the two ends.
  const lift = Math.min(320, 120 + Math.abs(targetX - sourceX) * 0.15);
  const apex = forward
    ? Math.min(sourceY, targetY) - lift
    : Math.max(sourceY, targetY) + lift;
  const reach = forward ? 60 : -60;
  const path = `M ${sourceX} ${sourceY} C ${sourceX + Math.abs(reach) * 1.5} ${apex}, ${targetX - Math.abs(reach) * 1.5} ${apex}, ${targetX} ${targetY}`;
  const x = (sourceX + targetX) / 2;
  const y = 0.125 * sourceY + 0.75 * apex + 0.125 * targetY;
  return [path, x, y, true];
}
