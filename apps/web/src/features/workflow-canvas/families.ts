import type { TaskKind } from '@/operations/workflow-document';

// Each family of steps has its own hue on its icon tile (research R12); status colours appear
// only as rings, dots and taken edges, so a kind is never read as a state.

type Family =
  'call' | 'data' | 'code' | 'event' | 'flow' | 'time' | 'run' | 'error';

const FAMILY: Record<TaskKind, Family> = {
  http: 'call',
  set: 'data',
  'run-script': 'code',
  'run-shell': 'code',
  'run-workflow': 'run',
  emit: 'event',
  listen: 'event',
  wait: 'time',
  switch: 'flow',
  for: 'flow',
  fork: 'flow',
  try: 'flow',
  do: 'flow',
  raise: 'error',
  advanced: 'code',
};

const TILE: Record<Family, string> = {
  call: 'bg-blue-500/12 text-blue-600 ring-blue-500/25 dark:text-blue-300',
  data: 'bg-teal-500/12 text-teal-600 ring-teal-500/25 dark:text-teal-300',
  code: 'bg-slate-500/12 text-slate-700 ring-slate-500/25 dark:text-slate-300',
  event: 'bg-amber-500/14 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  flow: 'bg-violet-500/12 text-violet-600 ring-violet-500/25 dark:text-violet-300',
  time: 'bg-sky-500/12 text-sky-600 ring-sky-500/25 dark:text-sky-300',
  run: 'bg-indigo-500/12 text-indigo-600 ring-indigo-500/25 dark:text-indigo-300',
  error: 'bg-rose-500/12 text-rose-600 ring-rose-500/25 dark:text-rose-300',
};

const ACCENT: Record<Family, string> = {
  call: 'border-t-blue-500',
  data: 'border-t-teal-500',
  code: 'border-t-slate-500',
  event: 'border-t-amber-500',
  flow: 'border-t-violet-500',
  time: 'border-t-sky-500',
  run: 'border-t-indigo-500',
  error: 'border-t-rose-500',
};

// The classes of a kind's icon tile.
export function tileOf(kind: TaskKind): string {
  return TILE[FAMILY[kind]];
}

// The top accent of a container of a kind.
export function accentOf(kind: TaskKind): string {
  return ACCENT[FAMILY[kind]];
}
