import type { Phase, TaskStatus, Trigger } from '@/libs/data-access/types';
import type { Tone } from '@/libs/ui/composites/status';

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

// The word of a phase: "Faulted".
export function phaseLabel(phase: Phase): string {
  return PHASE[phase].label;
}

// The tone that colours a phase.
export function phaseTone(phase: Phase): Tone {
  return PHASE[phase].tone;
}

// A phase as a status shows it, given to the `ui` lib's `Status`.
export interface PhaseState {
  readonly tone: Tone;
  readonly label: string;
  // Whether its dot pulses: the run is starting or running.
  readonly live: boolean;
}

// The status of a phase: its tone, its word and whether it is changing.
export function phaseStatusOf(phase: Phase): PhaseState {
  const { label, tone } = PHASE[phase];
  const live = phase === 'running' || phase === 'pending';
  return { tone, label, live };
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

// The word of a task's status: "Skipped".
export function taskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS[status].label;
}

// The tone that colours a task's status.
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

// What started a run, as a column names it: "Schedule".
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

// What a person may do with an instance in a phase; the API refuses the rest (002 FR-017).
export interface Controls {
  readonly suspend: boolean;
  readonly resume: boolean;
  readonly cancel: boolean;
  readonly restart: boolean;
  readonly remove: boolean;
}

// The controls a phase allows: an ended run is restarted or removed, a running one held or
// cancelled.
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
