import type { TaskRecord } from '@/libs/data-access/types';

export interface TaskProgress {
  readonly status: TaskRecord['status'];
  // How many times the task ran (iterations, later visits); its attempts count once.
  readonly runs: number;
  // The attempt of its latest run, above 1 when a retry or an outage repeated it.
  readonly attempt: number;
  // When the next attempt begins, while the latest attempt faulted and is retried.
  readonly retryAt: string | null;
}

// Each task's latest progress on a run, by the task's pointer. A task that ran several times
// (iterations, retries, later visits) shows its latest record and how many runs there were; a
// task that holds others and has no record of its own shows its latest descendant's status.
// One pass over the records, walking each record's pointer up through the tasks that hold it.
export function progressOf(
  records: readonly TaskRecord[],
  pointers: readonly string[],
): Map<string, TaskProgress> {
  const progress = new Map<string, TaskProgress>();
  const known = new Set(pointers);
  const own = new Set(records.map((record) => record.reference));

  for (const record of records) {
    const seen = progress.get(record.reference);
    const before = seen?.runs ?? 0;
    const again = seen !== undefined && seen.retryAt !== null;
    const attempt = again
      ? Math.max(record.attempt, seen.attempt + 1)
      : record.attempt;
    progress.set(record.reference, {
      status: record.status,
      runs: again ? before : before + 1,
      attempt,
      retryAt: record.retryAt,
    });

    for (const holder of holdersOf(record.reference))
      if (known.has(holder) && !own.has(holder))
        progress.set(holder, {
          status: record.status,
          runs: 1,
          attempt: 1,
          retryAt: null,
        });
  }

  return progress;
}

export interface RecordAttempt {
  // Which attempt of its task the record is.
  readonly attempt: number;
  // Whether a later attempt of its task followed it.
  readonly retried: boolean;
}

// Each record's attempt, by execution. A record that follows a retried record of the same task
// is its next attempt, whichever way the retry ran: the engine numbers a step's attempts, and a
// `try` around several steps runs them again as new executions of attempt 1.
export function attemptsOf(
  records: readonly TaskRecord[],
): Map<string, RecordAttempt> {
  const attempts = new Map<string, RecordAttempt>();
  // A task's latest record while it waits to be tried again.
  const pending = new Map<string, { execution: string; attempt: number }>();

  for (const record of records) {
    const before = pending.get(record.reference);
    const attempt =
      before === undefined
        ? record.attempt
        : Math.max(record.attempt, before.attempt + 1);

    if (before !== undefined)
      attempts.set(before.execution, {
        attempt: before.attempt,
        retried: true,
      });

    attempts.set(record.execution, { attempt, retried: false });

    if (record.retryAt === null) pending.delete(record.reference);
    else
      pending.set(record.reference, { execution: record.execution, attempt });
  }

  return attempts;
}

// Whether the task waits for its next attempt: its latest attempt faulted, and the run goes on.
export function isRetrying(
  progress: TaskProgress | undefined,
  advancing: boolean,
): boolean {
  return (
    advancing && progress?.status === 'faulted' && progress.retryAt !== null
  );
}

// The pointers of the tasks a task's pointer lies in: `/do/0/a/do/1/b` → `/do/0/a`.
function holdersOf(reference: string): string[] {
  const tokens = reference.split('/');
  const holders: string[] = [];

  for (let end = tokens.length - 3; end >= 3; end -= 1)
    holders.push(tokens.slice(0, end).join('/'));

  return holders;
}
