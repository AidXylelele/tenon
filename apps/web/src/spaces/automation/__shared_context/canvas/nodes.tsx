'use client';

import { Handle, type NodeProps, Position } from '@xyflow/react';
import { cn } from 'cn';
import {
  CalendarClockIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  FlagIcon,
  HandIcon,
  PlusIcon,
  RadioIcon,
} from 'lucide-react';
import { infoOf } from '../document/kinds';
import { summaryOf } from '../document/summary';
import { accentOf, tileOf } from '../outline/families';
import { TaskIcon } from '../outline/task-icon';
import { isUnended, taskStatusLabel } from '../vocabulary';
import { useCanvas } from './canvas-context';
import { type CanvasNode, SIZE } from './graph';

export type CanvasNodeData = { readonly node: CanvasNode };

type Props = NodeProps & { readonly data: CanvasNodeData };

const HANDLE = '!size-2.5 !border-2 !border-background !bg-muted-foreground/60';

const STATUS_RING: Record<string, string> = {
  running: 'ring-2 ring-sky-500/70 shadow-[0_0_0_6px] shadow-sky-500/10',
  completed: 'ring-2 ring-emerald-500/60',
  faulted: 'ring-2 ring-red-500/70 shadow-[0_0_0_6px] shadow-red-500/10',
  cancelled: 'ring-2 ring-zinc-400/60',
  skipped: 'opacity-60',
};

// The trigger: how a run of the workflow begins.
export function StartNode({ data }: Props) {
  const canvas = useCanvas();
  const selected = canvas.selected === data.node.id;
  const kind = canvas.trigger;
  const Icon =
    kind.startsWith('Every') ||
    kind.includes('schedule') ||
    kind.includes('after')
      ? CalendarClockIcon
      : kind.startsWith('When an event')
        ? RadioIcon
        : HandIcon;
  const started = canvas.phase !== null && canvas.phase !== 'pending';
  const flagged = canvas.flagged === data.node.id;

  return (
    <button
      type="button"
      onKeyDown={(event) =>
        event.key === 'Enter' && canvas.onSelect(data.node.id)
      }
      className={cn(
        'flex size-full items-center gap-3 rounded-2xl border bg-card px-3 text-left shadow-xs transition-shadow hover:shadow-md',
        selected && 'ring-3 ring-primary/30 border-primary/60',
        started && 'ring-2 ring-emerald-500/50',
        flagged && 'border-red-500/70 ring-3 ring-red-500/25',
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">Start</span>
        <span className="line-clamp-2 block text-xs leading-snug text-muted-foreground">
          {kind}
        </span>
      </span>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className={HANDLE}
        isConnectable={false}
      />
    </button>
  );
}

export function EndNode() {
  const canvas = useCanvas();
  const phase = canvas.phase;
  const tone =
    phase === 'completed'
      ? 'bg-emerald-500 text-white'
      : phase === 'faulted'
        ? 'bg-red-500 text-white'
        : phase === 'cancelled'
          ? 'bg-zinc-400 text-white'
          : 'bg-muted text-muted-foreground';

  return (
    <div
      className={cn(
        'flex size-full items-center justify-center rounded-full border shadow-xs',
        tone,
      )}
      title="End"
    >
      {phase === 'completed' ? (
        <CircleCheckIcon className="size-6" />
      ) : (
        <FlagIcon className="size-5" />
      )}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className={HANDLE}
        isConnectable={false}
      />
    </div>
  );
}

// One step: its kind's tile, its name, what it does in one line, and on a run its status.
export function TaskNode({ data }: Props) {
  const canvas = useCanvas();
  const node = data.node;
  const entry = node.entry;

  if (entry === null) return null;

  const selected = canvas.selected === node.id;
  const flagged = canvas.flagged === node.id;
  const seen = canvas.progress?.get(node.id);
  const faulted =
    canvas.faultAt !== null &&
    (canvas.faultAt === node.id || canvas.faultAt.startsWith(`${node.id}/`));
  const status = faulted ? 'faulted' : seen?.status;
  const cases = node.cases;
  const connectable = canvas.editable && !node.branch;

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        canvas.onSelect(node.id);
      }}
      aria-pressed={selected}
      aria-label={`${entry.name}, ${infoOf(entry.kind).label}`}
      className={cn(
        'group relative flex size-full cursor-pointer flex-col rounded-2xl border bg-card shadow-xs transition-shadow outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50',
        status !== undefined && STATUS_RING[status],
        selected && 'border-primary/60 ring-3 ring-primary/30',
        flagged && 'border-red-500/70 ring-3 ring-red-500/25',
      )}
    >
      <div className="flex h-16 items-center gap-3 px-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl ring-1',
            tileOf(entry.kind),
          )}
        >
          <TaskIcon kind={entry.kind} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{entry.name}</span>
            {flagged && (
              <CircleAlertIcon
                className="size-3.5 shrink-0 text-red-500"
                aria-label="Has a problem"
              />
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {summaryOf(entry)}
          </span>
        </span>
        {node.leaves && (
          <span
            className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground"
            title="then exit"
          >
            leaves the block
          </span>
        )}
      </div>
      {cases.length > 0 && (
        <ol className="flex flex-col px-3 pb-2">
          {cases.map((each, index) => (
            <li
              key={`${each.name}-${index}`}
              className="flex h-6 items-center justify-end gap-1.5 text-[11px] text-muted-foreground"
            >
              <span className="truncate">
                {each.name}
                {each.when === null && (
                  <span className="opacity-70"> (default)</span>
                )}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`case-${each.index}`}
                className={cn(HANDLE, '!bg-violet-500')}
                style={{
                  top: SIZE.node.height + index * SIZE.case + SIZE.case / 2 - 4,
                }}
                isConnectable={connectable}
              />
            </li>
          ))}
        </ol>
      )}
      {seen !== undefined && (
        <StatusChip status={status ?? seen.status} runs={seen.runs} />
      )}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className={HANDLE}
        style={{ top: SIZE.node.height / 2 }}
        isConnectable={connectable}
      />
      {entry.kind !== 'raise' && (
        // A choice leaves from here when no case matches; any other step goes on from here.
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          className={HANDLE}
          style={{ top: SIZE.node.height / 2 }}
          isConnectable={connectable}
        />
      )}
    </div>
  );
}

function StatusChip({
  status,
  runs,
}: {
  readonly status: string;
  readonly runs: number;
}) {
  const tone =
    status === 'running'
      ? 'bg-sky-500 text-white'
      : status === 'completed'
        ? 'bg-emerald-500 text-white'
        : status === 'faulted'
          ? 'bg-red-500 text-white'
          : 'bg-zinc-400 text-white';
  const label = taskStatusLabel(
    status as Parameters<typeof taskStatusLabel>[0],
  );

  return (
    <span
      className={cn(
        'absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm',
        tone,
      )}
    >
      {status === 'running' && (
        <span className="size-1.5 animate-pulse rounded-full bg-white" />
      )}
      {label}
      {runs > 1 && <span className="opacity-80">×{runs}</span>}
    </span>
  );
}

// A step that holds others: its header and, under it, a lane per list it holds.
export function ContainerNode({ data }: Props) {
  const canvas = useCanvas();
  const node = data.node;
  const entry = node.entry;

  if (entry === null) return null;

  const selected = canvas.selected === node.id;
  const flagged = canvas.flagged === node.id;
  const seen = canvas.progress?.get(node.id);
  const running =
    seen?.status === 'running' &&
    canvas.phase !== null &&
    isUnended(canvas.phase);

  return (
    <div
      className={cn(
        'relative size-full rounded-3xl border border-t-4 bg-muted/35 shadow-xs backdrop-blur-[1px]',
        accentOf(entry.kind),
        selected && 'ring-3 ring-primary/30',
        flagged && 'ring-3 ring-red-500/25',
        running && 'ring-2 ring-sky-500/50',
      )}
    >
      <button
        type="button"
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;

          event.preventDefault();
          canvas.onSelect(node.id);
        }}
        className="flex h-[52px] w-full items-center gap-2.5 rounded-t-3xl px-4 text-left hover:bg-muted/60"
        aria-label={`${entry.name}, ${infoOf(entry.kind).label}`}
      >
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg ring-1',
            tileOf(entry.kind),
          )}
        >
          <TaskIcon kind={entry.kind} className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            {entry.name}
            {flagged && (
              <CircleAlertIcon
                className="size-3.5 text-red-500"
                aria-label="Has a problem"
              />
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {summaryOf(entry)}
          </span>
        </span>
      </button>
      {node.lanes.map((lane) => (
        <div
          key={lane.pointer}
          className={cn(
            'absolute right-3 left-3 rounded-2xl border border-dashed',
            lane.label === 'If it fails'
              ? 'border-rose-400/40 bg-rose-500/[0.03]'
              : 'border-border bg-background/60',
          )}
          style={{ top: lane.y - 6, height: lane.height + 12 }}
        >
          <span
            className={cn(
              'absolute top-1.5 left-3 text-[11px] font-medium',
              lane.label === 'If it fails'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-muted-foreground',
            )}
          >
            {lane.label}
          </span>
        </div>
      ))}
      {seen !== undefined && (
        <StatusChip status={seen.status} runs={seen.runs} />
      )}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className={HANDLE}
        isConnectable={canvas.editable && !node.branch}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className={HANDLE}
        isConnectable={canvas.editable && !node.branch}
      />
    </div>
  );
}

// Where a list takes a new step.
export function AddNode({ data }: Props) {
  const canvas = useCanvas();
  const addTo = data.node.addTo;

  if (addTo === null) return null;

  return (
    <button
      type="button"
      onClick={() => canvas.onInsert(addTo.listPointer, addTo.index)}
      className="flex size-full items-center justify-center gap-1.5 rounded-full border border-dashed border-primary/40 bg-background text-xs font-medium text-primary transition-colors hover:border-primary hover:bg-primary/5"
    >
      <PlusIcon className="size-3.5" />
      Add step
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!opacity-0"
        isConnectable={false}
      />
    </button>
  );
}
