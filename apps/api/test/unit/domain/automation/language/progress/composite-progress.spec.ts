import { FlowDirective } from '../../../../../../src/domain/automation/language/flow-directive.js';
import { ErrorType } from '../../../../../../src/domain/automation/language/error-type.js';
import { EntryStage } from '../../../../../../src/domain/automation/language/stages/entry-stage.js';
import { TaskEnding } from '../../../../../../src/domain/automation/language/task-ending.js';
import { ForkProgress } from '../../../../../../src/domain/automation/language/progress/fork-progress.js';
import { ForProgress } from '../../../../../../src/domain/automation/language/progress/for-progress.js';
import { Sequence } from '../../../../../../src/domain/automation/language/sequence.js';
import { InconsistentProgressError } from '../../../../../../src/domain/errors.js';
import {
  answer,
  completedAt,
  definitionOf,
  evaluatedAs,
  pointerOf,
  scopeOf,
} from '../../../../../support/progress.js';

const colors = [
  { setRed: { set: { colors: '${ .colors + ["red"] }' }, then: 'setGreen' } },
  { setBlue: { set: { colors: '${ .colors + ["blue"] }' }, then: 'end' } },
  {
    setGreen: {
      set: { colors: '${ .colors + ["green"] }' },
      then: 'setBlue',
    },
  },
];

describe('composite progress', () => {
  it('a_do_task_follows_the_flow_directives_of_its_tasks', () => {
    const definition = definitionOf([{ paint: { do: colors } }]);
    const scope = scopeOf(definition, '/do/0/paint', { colors: [] });
    const started = EntryStage.begin(scope);

    const afterRed = started.progress.childEnded(
      pointerOf('/do/0/paint/do/0/setRed'),
      completedAt(definition, '/do/0/paint/do/0/setRed', { colors: ['red'] }),
      scope,
    );
    const afterGreen = afterRed.progress.childEnded(
      pointerOf('/do/0/paint/do/2/setGreen'),
      completedAt(definition, '/do/0/paint/do/2/setGreen', {
        colors: ['red', 'green'],
      }),
      scope,
    );
    const ended = afterGreen.progress
      .childEnded(
        pointerOf('/do/0/paint/do/1/setBlue'),
        completedAt(definition, '/do/0/paint/do/1/setBlue', {
          colors: ['red', 'green', 'blue'],
        }),
        scope,
      )
      .progress.ending();

    const startedNames = [started, afterRed, afterGreen].map((step) =>
      step.starts.map((start) => start.reference.toString()),
    );
    expect(startedNames).toEqual([
      ['/do/0/paint/do/0/setRed'],
      ['/do/0/paint/do/2/setGreen'],
      ['/do/0/paint/do/1/setBlue'],
    ]);
    expect(ended?.output).toEqual({ colors: ['red', 'green', 'blue'] });
    expect(ended?.directive).toBe(FlowDirective.End);
  });

  it('a_faulted_child_faults_its_do_task_with_the_same_error', () => {
    const definition = definitionOf([{ paint: { do: colors } }]);
    const scope = scopeOf(definition, '/do/0/paint', { colors: [] });
    const started = EntryStage.begin(scope).progress;
    const childAt = pointerOf('/do/0/paint/do/0/setRed');
    const error = ErrorType.Runtime.errorAt(childAt, 'boom');

    const ending = started
      .childEnded(childAt, TaskEnding.faulted(error), scope)
      .progress.ending();

    expect(ending?.failure).toBe(error);
  });

  it('each_for_iteration_takes_the_previous_output_and_its_item_and_index', () => {
    const definition = definitionOf([
      {
        loop: {
          for: { each: 'color', in: '.colors' },
          do: [{ mark: { set: { seen: '${ $color }' } } }],
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/loop', {
      colors: ['red', 'blue'],
    });
    const collecting = EntryStage.begin(scope).progress;
    const markAt = '/do/0/loop/do/0/mark';

    const first = collecting.record(
      answer(collecting.work(scope), {
        evaluate: evaluatedAs(() => ['red', 'blue']),
      }),
      scope,
    );
    const second = first.progress.childEnded(
      pointerOf(markAt),
      completedAt(definition, markAt, { seen: 'red' }),
      scope,
    );
    const ended = second.progress
      .childEnded(
        pointerOf(markAt),
        completedAt(definition, markAt, { seen: 'blue' }),
        scope,
      )
      .progress.ending();

    expect(first.starts).toEqual([
      expect.objectContaining({
        input: { colors: ['red', 'blue'] },
        variables: { color: 'red', index: 0 },
      }),
    ]);
    expect(second.starts).toEqual([
      expect.objectContaining({
        input: { seen: 'red' },
        variables: { color: 'blue', index: 1 },
      }),
    ]);
    expect(ended?.output).toEqual({ seen: 'blue' });
  });

  it('a_for_over_an_empty_collection_completes_with_its_input', () => {
    const definition = definitionOf([
      { loop: { for: { in: '.items' }, do: [{ mark: { set: { a: 1 } } }] } },
    ]);
    const scope = scopeOf(definition, '/do/0/loop', { items: [] });
    const collecting = EntryStage.begin(scope).progress;

    const ending = collecting
      .record(
        answer(collecting.work(scope), { evaluate: evaluatedAs(() => []) }),
        scope,
      )
      .progress.ending();

    expect(ending?.output).toEqual({ items: [] });
  });

  it('a_for_with_an_empty_body_completes_over_any_number_of_items', () => {
    const definition = definitionOf([
      { loop: { for: { in: '.items' }, do: [] } },
    ]);
    const items = Array.from({ length: 100_000 }, (item, index) => index);
    const scope = scopeOf(definition, '/do/0/loop', { items });
    const collecting = EntryStage.begin(scope).progress;

    const ending = collecting
      .record(
        answer(collecting.work(scope), { evaluate: evaluatedAs(() => items) }),
        scope,
      )
      .progress.ending();

    expect(ending?.output).toEqual({ items });
  });

  it('a_fork_waiting_twice_for_the_same_branch_is_refused', () => {
    const build = () =>
      new ForkProgress({ outputs: [null, null], pending: [1, 1] });

    expect(build).toThrow(InconsistentProgressError);
  });

  it('a_for_iterating_before_it_collected_its_items_is_refused', () => {
    const sequence = new Sequence({
      position: 0,
      variables: {},
      outcome: null,
    });
    const build = () =>
      new ForProgress({ input: {}, items: null, index: 0, data: {}, sequence });

    expect(build).toThrow(InconsistentProgressError);
  });

  it('a_fork_joins_its_branch_outputs_in_declaration_order', () => {
    const definition = definitionOf([
      {
        both: {
          fork: {
            branches: [{ a: { set: { a: 1 } } }, { b: { set: { b: 2 } } }],
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/both', {});
    const started = EntryStage.begin(scope);

    const afterB = started.progress.childEnded(
      pointerOf('/do/0/both/fork/branches/1/b'),
      completedAt(definition, '/do/0/both/fork/branches/1/b', { b: 2 }),
      scope,
    ).progress;
    const ending = afterB
      .childEnded(
        pointerOf('/do/0/both/fork/branches/0/a'),
        completedAt(definition, '/do/0/both/fork/branches/0/a', { a: 1 }),
        scope,
      )
      .progress.ending();

    expect(started.starts).toHaveLength(2);
    expect(afterB.ending()).toBeNull();
    expect(ending?.output).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('a_competing_fork_takes_the_output_of_the_first_branch_to_complete', () => {
    const definition = definitionOf([
      {
        race: {
          fork: {
            compete: true,
            branches: [{ a: { set: { a: 1 } } }, { b: { set: { b: 2 } } }],
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/race', {});
    const started = EntryStage.begin(scope).progress;

    const ending = started
      .childEnded(
        pointerOf('/do/0/race/fork/branches/1/b'),
        completedAt(definition, '/do/0/race/fork/branches/1/b', { b: 2 }),
        scope,
      )
      .progress.ending();

    expect(ending?.output).toEqual({ b: 2 });
  });

  it('a_fork_branch_that_ends_the_workflow_ends_the_fork_with_its_directive', () => {
    const definition = definitionOf([
      {
        both: {
          fork: {
            branches: [
              { a: { set: { a: 1 }, then: 'end' } },
              { b: { set: { b: 2 } } },
            ],
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/both', {});
    const started = EntryStage.begin(scope).progress;

    const ending = started
      .childEnded(
        pointerOf('/do/0/both/fork/branches/0/a'),
        completedAt(definition, '/do/0/both/fork/branches/0/a', { a: 1 }),
        scope,
      )
      .progress.ending();

    expect(ending?.output).toEqual({ a: 1 });
    expect(ending?.directive).toBe(FlowDirective.End);
  });

  it('a_fork_takes_the_end_of_each_branch_once', () => {
    const definition = definitionOf([
      {
        both: {
          fork: {
            branches: [{ a: { set: { a: 1 } } }, { b: { set: { b: 2 } } }],
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/both', {});
    const started = EntryStage.begin(scope).progress;
    const bAt = '/do/0/both/fork/branches/1/b';
    const bEnded = completedAt(definition, bAt, { b: 2 });

    const afterB = started.childEnded(pointerOf(bAt), bEnded, scope).progress;
    const again = afterB.childEnded(pointerOf(bAt), bEnded, scope).progress;

    expect(again.ending()).toBeNull();
  });

  it('a_matching_switch_case_directs_the_flow_and_keeps_the_input', () => {
    const definition = definitionOf([
      {
        pick: {
          switch: [
            { red: { when: '.color == "red"', then: 'setRed' } },
            { other: { then: 'setOther' } },
          ],
        },
      },
      { setRed: { set: { a: 1 } } },
      { setOther: { set: { a: 2 } } },
    ]);
    const scope = scopeOf(definition, '/do/0/pick', { color: 'red' });
    const deciding = EntryStage.begin(scope).progress;

    const ending = deciding
      .record(
        answer(deciding.work(scope), { evaluate: evaluatedAs(() => true) }),
        scope,
      )
      .progress.ending();

    const next = ending?.directive?.nextAfter(0, definition.body);
    expect(ending?.output).toEqual({ color: 'red' });
    expect(next).toBe(1);
  });

  it('a_switch_without_a_match_takes_its_default_case_or_its_own_then', () => {
    const definition = definitionOf([
      {
        pick: {
          switch: [{ red: { when: '.color == "red"', then: 'setRed' } }],
          then: 'end',
        },
      },
      { setRed: { set: { a: 1 } } },
    ]);
    const scope = scopeOf(definition, '/do/0/pick', { color: 'yellow' });
    const deciding = EntryStage.begin(scope).progress;

    const ending = deciding
      .record(
        answer(deciding.work(scope), { evaluate: evaluatedAs(() => false) }),
        scope,
      )
      .progress.ending();

    expect(ending?.output).toEqual({ color: 'yellow' });
    expect(ending?.directive).toBe(FlowDirective.End);
  });
});
