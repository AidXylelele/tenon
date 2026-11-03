import type { TaskRecord } from '@/libs/data-access/types';

export interface TaskProgress {
  readonly status: TaskRecord['status'];
  // How many times the task ran (iterations, retries, later visits).
  readonly runs: number;
}

// Each task's latest progress on a run, by the task's pointer. A task that ran several times
// (iterations, retries, later visits) shows its latest record and how many there were; a task
// that holds others and has no record of its own shows its latest descendant's status. One
// pass over the records, walking each record's pointer up through the tasks that hold it.
export function progressOf(
  records: readonly TaskRecord[],
  pointers: readonly string[],
): Map<string, TaskProgress> {
  const progress = new Map<string, TaskProgress>();
  const known = new Set(pointers);
  const own = new Set(records.map((record) => record.reference));

  for (const record of records) {
    const seen = progress.get(record.reference);
    progress.set(record.reference, {
      status: record.status,
      runs: (seen?.runs ?? 0) + 1,
    });

    for (const holder of holdersOf(record.reference))
      if (known.has(holder) && !own.has(holder))
        progress.set(holder, { status: record.status, runs: 1 });
  }

  return progress;
}

// The pointers of the tasks a task's pointer lies in: `/do/0/a/do/1/b` → `/do/0/a`.
function holdersOf(reference: string): string[] {
  const tokens = reference.split('/');
  const holders: string[] = [];

  for (let end = tokens.length - 3; end >= 3; end -= 1)
    holders.push(tokens.slice(0, end).join('/'));

  return holders;
}
