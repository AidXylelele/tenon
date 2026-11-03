import { isWithin } from '@/libs/document-text/json-pointer';
import type { JsonObject } from '@/libs/data-access/types';
import type { Problem } from '@/libs/data-access/problem';
import { allEntries } from './tasks';

// Where a problem of the check lies in the builder: the task it belongs to, and the path
// inside that task (`with/endpoint`), or a place outside every task (`/schedule`, `/use`).

export interface LocatedProblem {
  readonly pointer: string;
  readonly detail: string;
  // The deepest task whose pointer holds the problem, or null for the document's own parts.
  readonly taskPointer: string | null;
  // The rest of the pointer after the task, without its leading slash (`with/endpoint`).
  readonly field: string;
}

export function locate(draft: JsonObject, problem: Problem): LocatedProblem {
  const [first] = problem.errors;
  const pointer = first?.pointer ?? '';
  const detail = first?.detail ?? problem.detail;
  const holders = allEntries(draft)
    .map(({ entry }) => entry.pointer)
    .filter((taskPointer) => isWithin(pointer, taskPointer));
  const taskPointer = holders.reduce<string | null>(
    (deepest, each) =>
      deepest === null || each.length > deepest.length ? each : deepest,
    null,
  );
  const field =
    taskPointer === null
      ? pointer.slice(1)
      : pointer.slice(taskPointer.length + 1);
  return { pointer, detail, taskPointer, field };
}

// Whether a form field that edits `at` (a path inside its task) is where the problem lies.
export function isFieldOf(field: string, at: string): boolean {
  return field === at || field.startsWith(`${at}/`);
}
