'use client';

import { Handle, type NodeProps, Position } from '@xyflow/react';
import { cn } from 'cn';
import {
  CalendarClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  FlagIcon,
  HandIcon,
  NotebookPenIcon,
  PlusIcon,
  RadioIcon,
  RotateCwIcon,
  ShieldAlertIcon,
  SkipForwardIcon,
} from 'lucide-react';
import { infoOf } from '../document/kinds';
import { summaryOf } from '../document/summary';
import type { TaskEntry } from '../document/tasks';
import type { TaskProgress } from '../outline/progress';
import { accentOf, tileOf } from '../outline/families';
import { TaskIcon } from '../outline/task-icon';
import { taskStatusLabel } from '../vocabulary';
import { type CanvasState, useCanvas } from './canvas-context';
import { CASE, type CanvasNode, FAILURE, OUT } from './graph';
import { IN, type Point } from './layout';

export type CanvasNodeData = {
  readonly node: CanvasNode;
  // Where ELK put the node's ports, relative to the node.
  readonly ports: Readonly<Record<string, Point>>;
};

type Props = NodeProps & { readonly data: CanvasNodeData };

const HANDLE = '!size-2.5 !border-2 !border-background !bg-muted-foreground/60';

const STATUS_RING: Record<string, string> = {
  running: 'ring-2 ring-sky-500/70 shadow-[0_0_0_6px] shadow-sky-500/10',
  completed: 'ring-2 ring-emerald-500/60',
  faulted: 'ring-2 ring-red-500/70 shadow-[0_0_0_6px] shadow-red-500/10',
  cancelled: 'ring-2 ring-zinc-400/60',
  skipped: 'opacity-60',
};

// The trigger: how a run of the workflow begins, and the workflow's summary.
export function StartNode({ data }: Props) {
  const canvas = useCanvas();
  const node = data.node;
  const selected = canvas.selected === node.id;
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
  const flagged = canvas.flagged === node.id;

  return (
    <button
      type="button"
      onKeyDown={(event) => event.key === 'Enter' && canvas.onSelect(node.id)}
      className={cn(
        'flex size-full min-w-0 flex-col justify-center gap-1 overflow-hidden rounded-2xl border bg-card px-3 text-left shadow-xs transition-shadow hover:shadow-md',
        selected && 'border-primary/60 ring-3 ring-primary/30',
        started && 'ring-2 ring-emerald-500/50',
        flagged && 'border-red-500/70 ring-3 ring-red-500/25',
      )}
    >
      <span className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Start</span>
          <span className="line-clamp-2 block text-xs leading-snug text-muted-foreground">
            {kind}
          </span>
        </span>
      </span>
      {node.note !== null && <Note text={node.note} />}
      <Port name={OUT} type="source" data={data} />
    </button>
  );
}

export function EndNode({ data }: Props) {
  const canvas = useCanvas();
  const phase = canvas.phase;
  const tone =
    phase === 'completed'
      ? 'border-emerald-500 bg-emerald-500 text-white'
      : phase === 'faulted'
        ? 'border-red-500 bg-red-500 text-white'
        : phase === 'cancelled'
          ? 'border-zinc-400 bg-zinc-400 text-white'
          : 'bg-muted text-muted-foreground';

  return (
    <div
      className={cn(
        'flex size-full items-center justify-center gap-2 rounded-full border text-sm font-medium shadow-xs',
        tone,
      )}
    >
      {phase === 'completed' ? (
        <CircleCheckIcon className="size-4" />
      ) : (
        <FlagIcon className="size-4" />
      )}
      End
      <Port name={IN} type="target" data={data} />
    </div>
  );
}

// One step: its kind's tile, its name, what it does in one line, the author's note, how it is
// protected when it fails, and on a run its status.
export function TaskNode({ data }: Props) {
  const canvas = useCanvas();
  const node = data.node;
  const entry = node.entry;

  if (entry === null) return null;

  const protection = node.protection;
  const shown = protection?.step ?? entry;
  const selected = canvas.selected === node.id;
  const flagged = canvas.flagged === node.id;
  const seen = progressOf(canvas, shown, node.id);
  const status = faultedAt(canvas, node.id) ? 'faulted' : seen?.status;
  const connectable = canvas.editable && !node.branch;
  const hasDefault = node.cases.some((each) => each.when === null);

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
      aria-label={`${shown.name}, ${infoOf(shown.kind).label}`}
      className={cn(
        'group relative flex size-full cursor-pointer flex-col justify-center gap-1 rounded-2xl border bg-card px-3 py-2.5 shadow-xs transition-shadow outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50',
        status !== undefined && STATUS_RING[status],
        selected && 'border-primary/60 ring-3 ring-primary/30',
        flagged && 'border-red-500/70 ring-3 ring-red-500/25',
      )}
    >
      <Heading entry={shown} flagged={flagged} status={status} seen={seen} />
      {node.note !== null && <Note text={node.note} />}
      {protection !== null && (
        <span className="flex min-w-0 items-center gap-1.5">
          {protection.retry !== null && (
            <Badge icon={RotateCwIcon} text={protection.retry} />
          )}
          {protection.continues && (
            <Badge icon={SkipForwardIcon} text="Goes on if it fails" />
          )}
        </span>
      )}
      <Port name={IN} type="target" data={data} connectable={connectable} />
      {node.cases.map((each) => (
        <Port
          key={each.index}
          name={`${CASE}${String(each.index)}`}
          type="source"
          data={data}
          connectable={connectable}
          className="!bg-violet-500"
        />
      ))}
      {shown.kind !== 'raise' && !hasDefault && (
        // A choice leaves from here when no case matches; any other step goes on from here.
        <Port name={OUT} type="source" data={data} connectable={connectable} />
      )}
    </div>
  );
}

// A step that holds others. Open, it is a frame around its steps under its heading; closed, it
// is one node that counts them.
export function GroupNode({ data }: Props) {
  const canvas = useCanvas();
  const node = data.node;
  const entry = node.entry;

  if (entry === null) return null;

  const selected = canvas.selected === node.id;
  const flagged = canvas.flagged === node.id;
  const seen = canvas.progress?.get(node.id);
  const status = faultedAt(canvas, node.id) ? 'faulted' : seen?.status;
  const connectable = canvas.editable && !node.branch;

  return (
    <div
      className={cn(
        'relative size-full rounded-3xl border border-t-4 shadow-xs',
        node.collapsed ? 'bg-card' : 'bg-muted/35',
        accentOf(entry.kind),
        node.collapsed && status !== undefined && STATUS_RING[status],
        selected && 'ring-3 ring-primary/30',
        flagged && 'ring-3 ring-red-500/25',
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;

          event.preventDefault();
          canvas.onSelect(node.id);
        }}
        aria-label={`${entry.name}, ${infoOf(entry.kind).label}`}
        className="flex cursor-pointer flex-col gap-1 rounded-t-3xl px-3 py-2.5 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Heading
              entry={entry}
              flagged={flagged}
              status={status}
              seen={seen}
              steps={node.collapsed ? node.steps : null}
            />
          </div>
          <Toggle node={node} canvas={canvas} />
        </div>
        {node.detail !== null && (
          <span className="flex">
            <Badge
              icon={entry.kind === 'try' ? RotateCwIcon : null}
              text={node.detail}
            />
          </span>
        )}
        {node.note !== null && <Note text={node.note} />}
      </div>
      <Port name={IN} type="target" data={data} connectable={connectable} />
      <Port name={OUT} type="source" data={data} connectable={connectable} />
      {entry.kind === 'try' && (
        <Port
          name={FAILURE}
          type="source"
          data={data}
          className="!bg-rose-500"
        />
      )}
    </div>
  );
}

// The steps a `try` runs when its steps fail, beside it.
export function HandlerNode({ data }: Props) {
  const canvas = useCanvas();
  const node = data.node;
  const entry = node.entry;

  if (entry === null) return null;

  const used = [...(canvas.progress?.keys() ?? [])].some((pointer) =>
    pointer.startsWith(`${node.id}/`),
  );

  return (
    <div
      className={cn(
        'relative size-full rounded-3xl border-2 border-dashed border-rose-400/50 bg-rose-500/[0.04] shadow-xs',
        used && 'border-rose-500/80',
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/12 text-rose-600 ring-1 ring-rose-500/25 dark:text-rose-300">
          <ShieldAlertIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-rose-700 dark:text-rose-300">
            If {entry.name} fails
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {node.collapsed
              ? `${countText(node.steps)} run instead`
              : 'These steps run instead'}
          </span>
        </span>
        <Toggle node={node} canvas={canvas} />
      </div>
      <Port name={IN} type="target" data={data} />
      <Port name={OUT} type="source" data={data} />
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
      <Port name={IN} type="target" data={data} className="!opacity-0" />
    </button>
  );
}

function Heading({
  entry,
  flagged,
  status,
  seen,
  steps = null,
}: {
  readonly entry: TaskEntry;
  readonly flagged: boolean;
  readonly status: string | undefined;
  readonly seen: TaskProgress | undefined;
  // A closed group says how many steps it holds.
  readonly steps?: number | null;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
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
          {status !== undefined && (
            <StatusChip status={status} runs={seen?.runs ?? 1} />
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {steps === null
            ? summaryOf(entry)
            : `${infoOf(entry.kind).label}, ${countText(steps)}`}
        </span>
      </span>
    </span>
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
        'ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
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

function Note({ text }: { readonly text: string }) {
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

function Badge({
  icon: Icon,
  text,
}: {
  readonly icon: React.ComponentType<{ readonly className?: string }> | null;
  readonly text: string;
}) {
  return (
    <span
      className="inline-flex min-w-0 items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
      title={text}
    >
      {Icon !== null && <Icon className="size-3 shrink-0" />}
      <span className="truncate">{text}</span>
    </span>
  );
}

// Opens or closes a group; the viewer's arrangement, so it is offered on runs too.
function Toggle({
  node,
  canvas,
}: {
  readonly node: CanvasNode;
  readonly canvas: CanvasState;
}) {
  const Icon = node.collapsed ? ChevronDownIcon : ChevronUpIcon;
  const label = node.collapsed ? 'Show the steps' : 'Hide the steps';

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

// A handle where ELK put the port, on the side the canvas's direction gives it.
function Port({
  name,
  type,
  data,
  connectable = false,
  className,
}: {
  readonly name: string;
  readonly type: 'source' | 'target';
  readonly data: CanvasNodeData;
  readonly connectable?: boolean;
  readonly className?: string;
}) {
  const canvas = useCanvas();
  const position = positionOf(name, canvas.direction);
  const port = data.ports[name];
  const across = position === Position.Top || position === Position.Bottom;
  const style =
    port === undefined
      ? undefined
      : across
        ? { left: port.x }
        : { top: port.y };

  // Only a handle a connection can be dragged from shows; the others just anchor edges.
  const shown = connectable && type === 'source';

  return (
    <Handle
      type={type}
      position={position}
      id={name}
      className={cn(HANDLE, className, !shown && '!opacity-0')}
      style={style}
      isConnectable={connectable}
    />
  );
}

function positionOf(
  name: string,
  direction: CanvasState['direction'],
): Position {
  const down = direction === 'down';

  if (name === IN) return down ? Position.Top : Position.Left;

  if (name === FAILURE) return down ? Position.Right : Position.Bottom;

  return down ? Position.Bottom : Position.Right;
}

// A step protected on its own reports through the step; a block through itself.
function progressOf(
  canvas: CanvasState,
  shown: TaskEntry,
  id: string,
): TaskProgress | undefined {
  return canvas.progress?.get(shown.pointer) ?? canvas.progress?.get(id);
}

function faultedAt(canvas: CanvasState, id: string): boolean {
  const at = canvas.faultAt;
  return at !== null && (at === id || at.startsWith(`${id}/`));
}

function countText(steps: number): string {
  return steps === 1 ? '1 step' : `${String(steps)} steps`;
}
