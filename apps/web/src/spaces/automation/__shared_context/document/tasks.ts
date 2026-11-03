import { pointerOf, tokensOf } from '@/libs/document-text/json-pointer';
import type { JsonObject, JsonValue } from '@/libs/data-access/types';
import { isObject, valueAt, withValue } from './json';

// The task lists of a draft: what kind each task is, which lists it holds, and the edits a
// builder makes to them. A task list is the DSL's `[{ name: task }, …]`.

export type TaskKind =
  | 'set'
  | 'http'
  | 'wait'
  | 'emit'
  | 'listen'
  | 'raise'
  | 'switch'
  | 'for'
  | 'fork'
  | 'try'
  | 'do'
  | 'run-workflow'
  | 'run-script'
  | 'run-shell'
  | 'advanced';

export interface TaskEntry {
  readonly name: string;
  readonly kind: TaskKind;
  // The task's own pointer: `<list>/<index>/<name>`.
  readonly pointer: string;
  readonly index: number;
  readonly listPointer: string;
  readonly task: JsonObject;
}

export interface NestedList {
  readonly label: string;
  readonly pointer: string;
}

export const ROOT_LIST = '/do';

export function kindOf(task: JsonObject): TaskKind {
  if ('call' in task) return task.call === 'http' ? 'http' : 'advanced';

  if ('run' in task) return runKindOf(task.run);

  if ('for' in task) return 'for';

  for (const kind of [
    'set',
    'wait',
    'emit',
    'listen',
    'raise',
    'switch',
    'fork',
    'try',
  ] as const)
    if (kind in task) return kind;

  if ('do' in task) return 'do';

  return 'advanced';
}

function runKindOf(run: JsonValue | undefined): TaskKind {
  if (!isObject(run)) return 'advanced';

  if ('workflow' in run) return 'run-workflow';

  if ('script' in run) return 'run-script';

  if ('shell' in run) return 'run-shell';

  return 'advanced';
}

export function entriesAt(draft: JsonObject, listPointer: string): TaskEntry[] {
  const list = valueAt(draft, listPointer);

  if (!Array.isArray(list)) return [];

  return list.flatMap((item, index) => {
    if (!isObject(item)) return [];

    const [name] = Object.keys(item);

    if (name === undefined) return [];

    const task = item[name];

    if (!isObject(task)) return [];

    return [
      {
        name,
        kind: kindOf(task),
        pointer: `${listPointer}/${index}/${escapeToken(name)}`,
        index,
        listPointer,
        task,
      },
    ];
  });
}

// The task lists a task holds, in the order they run.
export function nestedListsOf(entry: TaskEntry): NestedList[] {
  const at = (path: string) => `${entry.pointer}${path}`;

  switch (entry.kind) {
    case 'do':
      return [{ label: 'Steps', pointer: at('/do') }];
    case 'for':
      return [{ label: 'For each item', pointer: at('/do') }];
    case 'try':
      return [
        { label: 'Try', pointer: at('/try') },
        { label: 'If it fails', pointer: at('/catch/do') },
      ];
    case 'fork':
      return [
        { label: 'Branches, side by side', pointer: at('/fork/branches') },
      ];
    default:
      return [];
  }
}

// Every task of the draft, depth first, with its depth.
export function allEntries(
  draft: JsonObject,
  listPointer = ROOT_LIST,
  depth = 0,
): { entry: TaskEntry; depth: number }[] {
  return entriesAt(draft, listPointer).flatMap((entry) => [
    { entry, depth },
    ...nestedListsOf(entry).flatMap((list) =>
      allEntries(draft, list.pointer, depth + 1),
    ),
  ]);
}

export function insertTask(
  draft: JsonObject,
  listPointer: string,
  index: number,
  name: string,
  task: JsonObject,
): JsonObject {
  const list = listAt(draft, listPointer);
  const items = list.slice();
  items.splice(index, 0, { [name]: task });
  return withValue(draft, listPointer, items);
}

export function removeTask(
  draft: JsonObject,
  listPointer: string,
  index: number,
): JsonObject {
  const items = listAt(draft, listPointer).filter((_, at) => at !== index);
  return withValue(draft, listPointer, items);
}

// Moves a task one place up (-1) or down (+1) in its list.
export function moveTask(
  draft: JsonObject,
  listPointer: string,
  index: number,
  step: -1 | 1,
): JsonObject {
  const items = listAt(draft, listPointer).slice();
  const target = index + step;

  if (target < 0 || target >= items.length) return draft;

  const [moved] = items.splice(index, 1);

  if (moved === undefined) return draft;

  items.splice(target, 0, moved);
  return withValue(draft, listPointer, items);
}

export function renameTask(
  draft: JsonObject,
  entry: TaskEntry,
  name: string,
): JsonObject {
  const items = listAt(draft, entry.listPointer).slice();
  items[entry.index] = { [name]: entry.task };
  return withValue(draft, entry.listPointer, items);
}

export function replaceTask(
  draft: JsonObject,
  entry: TaskEntry,
  task: JsonObject,
): JsonObject {
  const items = listAt(draft, entry.listPointer).slice();
  items[entry.index] = { [entry.name]: task };
  return withValue(draft, entry.listPointer, items);
}

// A name no task of the draft has yet, from a stem: `fetch`, `fetch2`, `fetch3`.
export function freeName(draft: JsonObject, stem: string): string {
  const taken = new Set(allEntries(draft).map(({ entry }) => entry.name));

  if (!taken.has(stem)) return stem;

  for (let suffix = 2; ; suffix += 1) {
    const name = `${stem}${suffix}`;

    if (!taken.has(name)) return name;
  }
}

// The entry a pointer names, when it names a task.
export function entryAt(draft: JsonObject, pointer: string): TaskEntry | null {
  const tokens = tokensOf(pointer);
  const name = tokens.pop();
  const index = tokens.pop();

  if (name === undefined || index === undefined) return null;

  const listPointer = pointerOf(tokens);
  return (
    entriesAt(draft, listPointer).find(
      (entry) => entry.index === Number(index) && entry.name === name,
    ) ?? null
  );
}

function listAt(draft: JsonObject, listPointer: string): JsonValue[] {
  const list = valueAt(draft, listPointer);
  return Array.isArray(list) ? list : [];
}

function escapeToken(token: string): string {
  return token.replaceAll('~', '~0').replaceAll('/', '~1');
}
