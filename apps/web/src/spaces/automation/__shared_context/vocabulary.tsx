import { cn } from 'cn';
import type {
  DeliveryStatus,
  Phase,
  TaskStatus,
  Trigger,
} from '@/libs/data-access/types';

// The words and colours of the run's states. Colour carries state only: blue runs, amber
// waits, violet is held, green completed, red failed, grey ended otherwise (research R8).

export type Tone =
  'idle' | 'busy' | 'waiting' | 'held' | 'done' | 'failed' | 'ended';

const TONE: Record<
  Tone,
  { readonly dot: string; readonly text: string; readonly line: string }
> = {
  idle: {
    dot: 'bg-muted-foreground/50',
    text: 'text-muted-foreground',
    line: 'bg-border',
  },
  busy: {
    dot: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-300',
    line: 'bg-sky-500',
  },
  waiting: {
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    line: 'bg-amber-500',
  },
  held: {
    dot: 'bg-violet-500',
    text: 'text-violet-700 dark:text-violet-300',
    line: 'bg-violet-500',
  },
  done: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    line: 'bg-emerald-500',
  },
  failed: {
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    line: 'bg-red-500',
  },
  ended: {
    dot: 'bg-zinc-400',
    text: 'text-muted-foreground',
    line: 'bg-zinc-300 dark:bg-zinc-700',
  },
};

export function toneClasses(tone: Tone) {
  return TONE[tone];
}

const PHASE: Record<Phase, { readonly label: string; readonly tone: Tone }> = {
  pending: { label: 'Pending', tone: 'idle' },
  running: { label: 'Running', tone: 'busy' },
  waiting: { label: 'Waiting', tone: 'waiting' },
  suspended: { label: 'Suspended', tone: 'held' },
  completed: { label: 'Completed', tone: 'done' },
  faulted: { label: 'Faulted', tone: 'failed' },
  cancelled: { label: 'Cancelled', tone: 'ended' },
};

export const PHASES = Object.keys(PHASE) as Phase[];

export function phaseLabel(phase: Phase): string {
  return PHASE[phase].label;
}

export function phaseTone(phase: Phase): Tone {
  return PHASE[phase].tone;
}

// An instance that has not ended still changes, so live views keep refreshing it.
export function isUnended(phase: Phase): boolean {
  return (
    phase === 'pending' ||
    phase === 'running' ||
    phase === 'waiting' ||
    phase === 'suspended'
  );
}

const TASK_STATUS: Record<
  TaskStatus,
  { readonly label: string; readonly tone: Tone }
> = {
  running: { label: 'Running', tone: 'busy' },
  completed: { label: 'Completed', tone: 'done' },
  faulted: { label: 'Faulted', tone: 'failed' },
  cancelled: { label: 'Cancelled', tone: 'ended' },
  skipped: { label: 'Skipped', tone: 'ended' },
};

export function taskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS[status].label;
}

export function taskStatusTone(status: TaskStatus): Tone {
  return TASK_STATUS[status].tone;
}

const TRIGGER: Record<Trigger, string> = {
  manual: 'By hand',
  schedule: 'Schedule',
  event: 'Event',
  parent: 'Parent run',
  detached: 'Detached from a run',
  restart: 'Restart',
};

export function triggerLabel(trigger: Trigger): string {
  return TRIGGER[trigger];
}

const STARTED: Record<Trigger, string> = {
  manual: 'Started by hand',
  schedule: 'Started by its schedule',
  event: 'Started by an event',
  parent: 'Started by a parent run',
  detached: 'Started detached from a run',
  restart: 'Restarted',
};

// How a run began, as a phrase: "Started by its schedule".
export function startedBy(trigger: Trigger): string {
  return STARTED[trigger];
}

const DELIVERY: Record<
  DeliveryStatus,
  { readonly label: string; readonly tone: Tone }
> = {
  pending: { label: 'Retrying', tone: 'waiting' },
  delivered: { label: 'Delivered', tone: 'done' },
  failed: { label: 'Failed', tone: 'failed' },
};

export function deliveryLabel(status: DeliveryStatus): string {
  return DELIVERY[status].label;
}

export function deliveryTone(status: DeliveryStatus): Tone {
  return DELIVERY[status].tone;
}

interface StatusProps {
  readonly tone: Tone;
  readonly label: string;
  // Whether the state is changing as it is shown: its dot pulses.
  readonly live?: boolean;
  readonly className?: string;
}

// A state as a coloured dot and its word.
export function Status({ tone, label, live = false, className }: StatusProps) {
  const classes = TONE[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium',
        classes.text,
        className,
      )}
    >
      <span className="relative flex size-2" aria-hidden>
        {live && (
          <span
            className={cn(
              'absolute inline-flex size-full animate-ping rounded-full opacity-60',
              classes.dot,
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            classes.dot,
          )}
        />
      </span>
      {label}
    </span>
  );
}

export function PhaseStatus({
  phase,
  className,
}: {
  readonly phase: Phase;
  readonly className?: string;
}) {
  const live = phase === 'running' || phase === 'pending';
  return (
    <Status
      tone={phaseTone(phase)}
      label={phaseLabel(phase)}
      live={live}
      className={className}
    />
  );
}

// What a person may do with an instance in a phase; the API refuses the rest (002 FR-017).
export interface Controls {
  readonly suspend: boolean;
  readonly resume: boolean;
  readonly cancel: boolean;
  readonly restart: boolean;
  readonly remove: boolean;
}

export function controlsOf(phase: Phase): Controls {
  const ended = !isUnended(phase);
  return {
    suspend: phase === 'running' || phase === 'waiting',
    resume: phase === 'suspended',
    cancel: !ended,
    restart: ended,
    remove: ended,
  };
}
