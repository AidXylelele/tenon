import { describe, expect, it } from 'vitest';
import type { JsonObject } from '@/libs/document-text/json';
import {
  allEntries,
  entriesAt,
  entryAt,
  freeName,
  insertTask,
  kindOf,
  moveTask,
  nestedListsOf,
  removeTask,
  renameTask,
  ROOT_LIST,
} from './tasks';

const draft = (): JsonObject => ({
  document: {
    dsl: '1.0.3',
    namespace: 'sales',
    name: 'route-lead',
    version: '1.0.0',
  },
  do: [
    {
      fetch: {
        call: 'http',
        with: { method: 'get', endpoint: 'https://crm.example.com' },
      },
    },
    {
      each: {
        for: { each: 'lead', in: '${ .leads }' },
        do: [
          {
            notify: {
              emit: { event: { with: { type: 'lead.seen', source: '/crm' } } },
            },
          },
        ],
      },
    },
    {
      guarded: {
        try: [{ risky: { call: 'openapi', with: {} } }],
        catch: { do: [] },
      },
    },
  ],
});

describe('the task lists of a draft', () => {
  it('reads each kind from the task it is', () => {
    const kinds = allEntries(draft()).map(({ entry }) => entry.kind);

    expect(kinds).toEqual(['http', 'for', 'emit', 'try', 'advanced']);
  });

  it('a_run_task_is_known_by_what_it_runs', () => {
    expect(kindOf({ run: { workflow: { name: 'x' } } })).toBe('run-workflow');
    expect(kindOf({ run: { container: { image: 'x' } } })).toBe('advanced');
  });

  it('points_at_each_task_by_its_list_index_and_name', () => {
    const pointers = allEntries(draft()).map(({ entry }) => entry.pointer);

    expect(pointers).toEqual([
      '/do/0/fetch',
      '/do/1/each',
      '/do/1/each/do/0/notify',
      '/do/2/guarded',
      '/do/2/guarded/try/0/risky',
    ]);
  });

  it('a_try_holds_its_tasks_and_the_tasks_that_handle_its_failure', () => {
    const [, , guarded] = entriesAt(draft(), ROOT_LIST);

    expect(
      guarded && nestedListsOf(guarded).map((list) => list.pointer),
    ).toEqual(['/do/2/guarded/try', '/do/2/guarded/catch/do']);
  });

  it('inserting_removing_and_moving_leave_the_given_draft_unchanged', () => {
    const original = draft();
    const inserted = insertTask(original, ROOT_LIST, 1, 'pause', {
      wait: { minutes: 1 },
    });
    const moved = moveTask(inserted, ROOT_LIST, 1, -1);
    const removed = removeTask(moved, ROOT_LIST, 0);

    expect(entriesAt(original, ROOT_LIST).map((entry) => entry.name)).toEqual([
      'fetch',
      'each',
      'guarded',
    ]);
    expect(entriesAt(moved, ROOT_LIST).map((entry) => entry.name)).toEqual([
      'pause',
      'fetch',
      'each',
      'guarded',
    ]);
    expect(entriesAt(removed, ROOT_LIST).map((entry) => entry.name)).toEqual([
      'fetch',
      'each',
      'guarded',
    ]);
  });

  it('a_task_inserted_into_a_missing_list_creates_the_list', () => {
    const inserted = insertTask(
      draft(),
      '/do/2/guarded/catch/do',
      0,
      'recover',
      { set: { ok: false } },
    );

    expect(entryAt(inserted, '/do/2/guarded/catch/do/0/recover')?.kind).toBe(
      'set',
    );
  });

  it('moving_past_either_end_changes_nothing', () => {
    const original = draft();

    expect(moveTask(original, ROOT_LIST, 0, -1)).toBe(original);
    expect(moveTask(original, ROOT_LIST, 2, 1)).toBe(original);
  });

  it('a_renamed_task_keeps_its_place_and_its_definition', () => {
    const [fetch] = entriesAt(draft(), ROOT_LIST);
    const renamed = fetch ? renameTask(draft(), fetch, 'loadLeads') : draft();

    expect(entryAt(renamed, '/do/0/loadLeads')?.task).toEqual(fetch?.task);
  });

  it('a_free_name_avoids_every_name_in_the_draft_nested_ones_too', () => {
    expect(freeName(draft(), 'notify')).toBe('notify2');
    expect(freeName(draft(), 'wait')).toBe('wait');
  });
});
