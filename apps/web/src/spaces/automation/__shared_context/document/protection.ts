import type { JsonObject, JsonValue } from '@/libs/data-access/types';
import { isObject } from './json';
import { entriesAt, nestedListsOf, type TaskEntry } from './tasks';
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
