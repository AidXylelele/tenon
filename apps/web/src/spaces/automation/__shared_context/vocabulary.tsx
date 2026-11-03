import type {
  DeliveryStatus,
  Phase,
  TaskStatus,
  Trigger,
} from '@/libs/data-access/types';
import { Status, type Tone } from '@/libs/ui/composites/status';

// The words of the run's states and the tone that colours each (research R8).

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

// A run that moves on its own: it has not ended and is not held, so its waits count down.
export function isAdvancing(phase: Phase): boolean {
  return isUnended(phase) && phase !== 'suspended';
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
  restart: 'Run again',
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
  restart: 'Run again by hand',
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
