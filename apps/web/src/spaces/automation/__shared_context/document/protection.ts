import type { JsonObject, JsonValue } from '@/libs/data-access/types';
import { isObject } from './json';
import {
  entriesAt,
  entryAt,
  nestedListsOf,
  renameTask,
  type TaskEntry,
} from './tasks';
import { durationOf, durationText } from './trigger';

// How a `try` protects one step on its own (research R16, R17): it retries the step, or it lets
// the run go on when the step fails, n8n's "Retry On Fail" and "On Error: Continue". The canvas
// draws it as that step with a badge and the panel edits it as the step's "If it fails". A
// `try` with steps of its own to run on failure stays a block.
export interface Protection {
  // The step the `try` protects.
  readonly step: TaskEntry;
  // What the retry does, in words, or null when the `try` does not retry.
  readonly retry: string | null;
  // Without a retry, a caught failure lets the run go on with the step's input.
  readonly continues: boolean;
}

export function protectionOf(
  draft: JsonObject,
  entry: TaskEntry,
): Protection | null {
  if (entry.kind !== 'try') return null;

  const handling = isObject(entry.task.catch) ? entry.task.catch : {};

  if ('do' in handling) return null;

  const steps = entriesAt(draft, `${entry.pointer}/try`);
  const [step] = steps;

  if (steps.length !== 1 || step === undefined) return null;

  if (nestedListsOf(step).length > 0) return null;

  const retry = retryTextOf(handling.retry);
  return { step, retry, continues: retry === null };
}

// The node a pointer is drawn as: a step a `try` protects on its own is drawn as its `try`.
export function protectorOf(draft: JsonObject, pointer: string): string {
  const match = /^(.*)\/try\/0\/[^/]+$/.exec(pointer);
  const holder = match?.[1];

  if (holder === undefined) return pointer;

  const entry = entryAt(draft, holder);

  if (entry === null) return pointer;

  return protectionOf(draft, entry) === null ? pointer : holder;
}

// A retry policy in words: "Retries up to 3 times, 1 second apart".
export function retryTextOf(policy: JsonValue | undefined): string | null {
  if (typeof policy === 'string') return `Retries as ${policy}`;

  if (!isObject(policy)) return null;

  const limit = isObject(policy.limit) ? policy.limit : {};
  const attempt = isObject(limit.attempt) ? limit.attempt : {};
  const count = typeof attempt.count === 'number' ? attempt.count : null;
  const delay = durationOf(policy.delay);
  const backoff = isObject(policy.backoff) ? policy.backoff : {};
  const growing = 'exponential' in backoff || 'linear' in backoff;
  const times = count === null ? 'Retries' : `Retries up to ${count} times`;
  const apart = delay === null ? '' : `, ${durationText(delay)} apart`;
  const longer = growing ? ', waiting longer each time' : '';
  return `${times}${apart}${longer}`;
}

// What a step does when it fails, as its panel offers it (FR-031): stop the run, go on, retry,
// or run other steps, which makes the `try` a block with an "If it fails" handler.
export type FailureChoice =
  | { readonly kind: 'stop' }
  | { readonly kind: 'continue' }
  | {
      readonly kind: 'retry';
      readonly attempts: number;
      readonly seconds: number;
      readonly growing: boolean;
    }
  | { readonly kind: 'handle' };

export const DEFAULT_RETRY = {
  kind: 'retry',
  attempts: 3,
  seconds: 5,
  growing: false,
} as const;

// The options a `try` takes over from the step it protects, since they shape the step as a
// whole: whether it runs, where the run goes after it, its data, its time limit and its note.
const MOVED = [
  'if',
  'then',
  'input',
  'output',
  'export',
  'timeout',
  'metadata',
];
const HANDLER = 'recover';

export function failureChoiceOf(
  protection: Protection | null,
  entry: TaskEntry,
): FailureChoice {
  if (protection === null)
    return entry.kind === 'try' ? { kind: 'handle' } : { kind: 'stop' };

  if (protection.continues) return { kind: 'continue' };

  const handling = isObject(entry.task.catch) ? entry.task.catch : {};
  const policy = isObject(handling.retry) ? handling.retry : {};
  const limit = isObject(policy.limit) ? policy.limit : {};
  const attempt = isObject(limit.attempt) ? limit.attempt : {};
  const delay = durationOf(policy.delay);
  const backoff = isObject(policy.backoff) ? policy.backoff : {};
  return {
    kind: 'retry',
    attempts:
      typeof attempt.count === 'number'
        ? attempt.count
        : DEFAULT_RETRY.attempts,
    seconds: delay === null ? DEFAULT_RETRY.seconds : secondsOf(delay),
    growing: 'exponential' in backoff || 'linear' in backoff,
  };
}

// The task the entry becomes for a choice: the step wrapped in a `try`, the `try` with other
// handling, or, to stop the run again, the step on its own.
export function withFailureChoice(
  entry: TaskEntry,
  protection: Protection | null,
  choice: FailureChoice,
): JsonObject {
  if (protection === null && entry.kind === 'try') return entry.task;

  if (choice.kind === 'stop')
    return protection === null
      ? entry.task
      : unwrapped(entry.task, protection.step.task);

  const wrapper =
    protection === null ? wrapped(entry.task, entry.name) : entry.task;
  const before = isObject(wrapper.catch) ? wrapper.catch : {};
  // Running other steps keeps the retries the step had: they run first.
  const retry = before.retry;
  const kept: JsonObject =
    choice.kind === 'handle' && retry !== undefined ? { retry } : {};
  const handling = { ...kept, ...handlingOf(choice) };
  const rest = Object.fromEntries(
    Object.entries(wrapper).filter(([key]) => key !== 'catch'),
  );
  return { ...rest, catch: handling };
}

// The `try` with the step it protects replaced.
export function withProtectedStep(
  entry: TaskEntry,
  protection: Protection,
  task: JsonObject,
): JsonObject {
  return { ...entry.task, try: [{ [protection.step.name]: task }] };
}

// A step renamed; a protected step and its `try` keep one name, the one jumps go to.
export function renamedStep(
  draft: JsonObject,
  entry: TaskEntry,
  protection: Protection | null,
  name: string,
): JsonObject {
  if (protection === null) return renameTask(draft, entry, name);

  const task = { ...entry.task, try: [{ [name]: protection.step.task }] };
  return renameTask(draft, { ...entry, task }, name);
}

function handlingOf(choice: FailureChoice): JsonObject {
  if (choice.kind === 'retry')
    return {
      retry: {
        delay: { seconds: choice.seconds },
        backoff: choice.growing ? { exponential: {} } : { constant: {} },
        limit: { attempt: { count: choice.attempts } },
      },
    };

  if (choice.kind === 'handle')
    return {
      as: 'error',
      do: [{ [HANDLER]: { set: { recovered: true } } }],
    };

  return {};
}

function wrapped(task: JsonObject, name: string): JsonObject {
  const moved = Object.entries(task).filter(([key]) => MOVED.includes(key));
  const kept = Object.entries(task).filter(([key]) => !MOVED.includes(key));
  return {
    ...Object.fromEntries(moved),
    try: [{ [name]: Object.fromEntries(kept) }],
  };
}

function unwrapped(wrapper: JsonObject, step: JsonObject): JsonObject {
  const moved = Object.entries(wrapper).filter(([key]) => MOVED.includes(key));
  return { ...step, ...Object.fromEntries(moved) };
}

function secondsOf(duration: {
  readonly amount: number;
  readonly unit: string;
}): number {
  if (duration.unit === 'minutes') return duration.amount * 60;

  if (duration.unit === 'hours') return duration.amount * 3600;

  if (duration.unit === 'days') return duration.amount * 86_400;

  return duration.amount;
}
