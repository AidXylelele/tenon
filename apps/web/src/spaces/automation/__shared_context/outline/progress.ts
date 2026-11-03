import { isWithin } from '@/libs/document-text/json-pointer';
import type { TaskRecord } from '@/libs/data-access/types';
import type { TaskProgress } from './workflow-outline';

// Each task's latest progress on a run, by the task's pointer. A task that ran several times
// (iterations, retries, later visits) shows its latest record and how many there were; a task
// that holds others and has no record of its own shows its latest descendant's status.
export function progressOf(
  records: readonly TaskRecord[],
  pointers: readonly string[],
): Map<string, TaskProgress> {
  const progress = new Map<string, TaskProgress>();

  for (const record of records) {
    const seen = progress.get(record.reference);
    progress.set(record.reference, {
      status: record.status,
      runs: (seen?.runs ?? 0) + 1,
    });
  }

  for (const pointer of pointers) {
    if (progress.has(pointer)) continue;

    const inside = records.filter((record) =>
      isWithin(record.reference, pointer),
    );
    const latest = inside.at(-1);

    if (latest !== undefined)
      progress.set(pointer, { status: latest.status, runs: 1 });
  }

  return progress;
}
