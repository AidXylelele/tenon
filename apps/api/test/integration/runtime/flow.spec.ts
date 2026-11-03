import { TaskStatus } from '../../../src/application/automation/instances/enums.js';
import type { JsonObject } from '../../../src/domain/automation/json.js';
import { RunOutcomeKind } from '../../../src/interface-adapters/workflows/enums.js';
import type { RunOutcome } from '../../../src/interface-adapters/workflows/interfaces.js';
import {
  ERRORS,
  JSON_HEADERS,
  RuntimeHarness,
  aWorkflow,
} from '../../support/runtime-harness.js';

let h: RuntimeHarness;

beforeAll(async () => {
  h = await RuntimeHarness.start();
});

afterAll(async () => {
  await h.close();
});

function outputOf(outcome: RunOutcome): unknown {
  if (outcome.kind !== RunOutcomeKind.Completed)
    throw new Error(`the run did not complete: ${JSON.stringify(outcome)}`);

  return outcome.output;
}

function errorOf(outcome: RunOutcome): JsonObject {
  if (outcome.kind !== RunOutcomeKind.Faulted)
    throw new Error(`the run did not fault: ${JSON.stringify(outcome)}`);

  return outcome.error;
}

function get(uri: string): JsonObject {
  return { call: 'http', with: { method: 'get', endpoint: uri } };
}

describe('flow directives', () => {
  it('then_continue_goes_to_the_next_task', async () => {
    const document = aWorkflow([
      { a: { set: { n: 1 }, then: 'continue' } },
      { b: { set: { n: '${ .n + 1 }' } } },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ n: 2 });
  });

  it('a_named_then_jumps_forward_over_tasks', async () => {
    const document = aWorkflow([
      { a: { set: { from: 'a' }, then: 'c' } },
      { b: { set: { from: 'b' } } },
      { c: { set: { from: '${ .from + "c" }' } } },
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ from: 'ac' });
    expect(observer.startedNamed('b')).toHaveLength(0);
  });

  it('a_backward_jump_revisits_tasks_under_unique_journal_names', async () => {
    const document = aWorkflow([
      { init: { set: { n: 0 } } },
      { inc: { set: { n: '${ .n + 1 }' } } },
      {
        check: {
          switch: [
            { again: { when: '${ .n < 3 }', then: 'inc' } },
            { done: { then: 'exit' } },
          ],
        },
      },
      { never: { set: { reached: true } } },
    ]);

    const { outcome, observer, journal } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ n: 3 });
    expect(observer.endedNamed('inc')).toHaveLength(3);
    expect(observer.startedNamed('never')).toHaveLength(0);
    const executions = observer.ended.map((task) => task.execution);
    expect(new Set(executions).size).toBe(executions.length);
    expect([...journal.keys()]).toEqual(
      expect.arrayContaining(['/do/1/inc', '/do/1/inc~2', '/do/1/inc~3']),
    );
  });

  it('exit_in_a_nested_do_ends_only_that_do', async () => {
    const document = aWorkflow([
      {
        outer: {
          do: [
            { a: { set: { x: 1 }, then: 'exit' } },
            { b: { set: { x: 2 } } },
          ],
        },
      },
      { after: { set: { y: '${ .x }' } } },
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ y: 1 });
    expect(observer.startedNamed('b')).toHaveLength(0);
  });

  it('exit_in_the_main_do_ends_the_workflow_with_that_output', async () => {
    const document = aWorkflow(
      [{ a: { set: { x: 1 }, then: 'exit' } }, { b: { set: { x: 2 } } }],
      { output: { as: '${ { final: .x } }' } },
    );

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ final: 1 });
  });

  it('end_in_a_nested_do_ends_the_whole_workflow_and_output_as_still_applies', async () => {
    const document = aWorkflow(
      [
        {
          outer: {
            do: [
              { a: { set: { x: 1 }, then: 'end' } },
              { b: { set: { x: 2 } } },
            ],
          },
        },
        { after: { set: { x: 3 } } },
      ],
      { output: { as: '${ { final: .x } }' } },
    );

    const { outcome, observer } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ final: 1 });
    expect(observer.startedNamed('b')).toHaveLength(0);
    expect(observer.startedNamed('after')).toHaveLength(0);
  });

  it('end_in_a_for_body_ends_the_workflow', async () => {
    const document = aWorkflow([
      {
        loop: {
          for: { in: '${ [1, 2, 3] }' },
          do: [{ stop: { set: { at: '${ $item }' }, then: 'end' } }],
        },
      },
      { after: { set: { reached: true } } },
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ at: 1 });
    expect(observer.endedNamed('stop')).toHaveLength(1);
    expect(observer.startedNamed('after')).toHaveLength(0);
  });

  it('end_in_a_try_body_and_in_a_catch_do_ends_the_workflow', async () => {
    const inTry = aWorkflow([
      {
        attempt: {
          try: [
            { a: { set: { x: 1 }, then: 'end' } },
            { b: { set: { x: 9 } } },
          ],
          catch: {},
        },
      },
      { after: { set: { reached: true } } },
    ]);
    const inCatch = aWorkflow([
      {
        attempt: {
          try: [
            {
              fail: {
                raise: {
                  error: { type: 'https://example.com/x', status: 400 },
                },
              },
            },
          ],
          catch: { do: [{ handle: { set: { x: 2 }, then: 'end' } }] },
        },
      },
      { after: { set: { reached: true } } },
    ]);

    const tried = await h.run(inTry, {});
    const caught = await h.run(inCatch, {});

    expect(outputOf(tried.outcome)).toEqual({ x: 1 });
    expect(tried.observer.startedNamed('after')).toHaveLength(0);
    expect(outputOf(caught.outcome)).toEqual({ x: 2 });
    expect(caught.observer.startedNamed('after')).toHaveLength(0);
  });

  it('end_in_a_function_body_ends_the_workflow', async () => {
    const document = aWorkflow(
      [{ invoke: { call: 'finish' } }, { after: { set: { reached: true } } }],
      {
        use: {
          functions: {
            finish: {
              do: [{ last: { set: { finished: true }, then: 'end' } }],
            },
          },
        },
      },
    );

    const { outcome, observer } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ finished: true });
    expect(observer.startedNamed('after')).toHaveLength(0);
  });

  it('then_on_a_composite_applies_after_its_body', async () => {
    const document = aWorkflow([
      { outer: { do: [{ a: { set: { x: 1 } } }], then: 'c' } },
      { b: { set: { x: 2 } } },
      { c: { set: { x: '${ .x * 10 }' } } },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ x: 10 });
  });
});

describe('switch', () => {
  const routing = aWorkflow([
    {
      route: {
        switch: [
          { electronic: { when: '${ .kind == "e" }', then: 'electronic' } },
          { physical: { when: '${ .kind == "p" }', then: 'physical' } },
          { fallback: { then: 'unknown' } },
        ],
      },
    },
    { electronic: { set: { path: 'e', kind: '${ .kind }' }, then: 'exit' } },
    { physical: { set: { path: 'p', kind: '${ .kind }' }, then: 'exit' } },
    { unknown: { set: { path: 'u', kind: '${ .kind }' } } },
  ]);

  it('the_first_matching_case_gives_the_next_task_and_the_data_passes_unchanged', async () => {
    const { outcome, observer } = await h.run(routing, { kind: 'p' });

    expect(outputOf(outcome)).toEqual({ path: 'p', kind: 'p' });
    expect(observer.endedNamed('route')[0]?.output).toEqual({ kind: 'p' });
    expect(observer.startedNamed('electronic')).toHaveLength(0);
  });

  it('the_default_case_applies_when_no_other_case_matches', async () => {
    const { outcome } = await h.run(routing, { kind: 'z' });

    expect(outputOf(outcome)).toEqual({ path: 'u', kind: 'z' });
  });

  it('no_matching_case_and_no_default_continues_with_the_task_s_own_then', async () => {
    const document = aWorkflow([
      {
        route: {
          switch: [{ hit: { when: '${ .go }', then: 'target' } }],
          then: 'other',
        },
      },
      { target: { set: { at: 'target' }, then: 'exit' } },
      { other: { set: { at: 'other' } } },
    ]);

    const { outcome } = await h.run(document, { go: false });

    expect(outputOf(outcome)).toEqual({ at: 'other' });
  });

  it('no_matching_case_without_then_continues_with_the_next_task', async () => {
    const document = aWorkflow([
      { route: { switch: [{ hit: { when: '${ .go }', then: 'end' } }] } },
      { next: { set: { at: 'next' } } },
    ]);

    const { outcome } = await h.run(document, { go: false });

    expect(outputOf(outcome)).toEqual({ at: 'next' });
  });

  it('a_case_may_end_or_exit', async () => {
    const document = aWorkflow([
      {
        outer: {
          do: [
            {
              route: {
                switch: [
                  { quit: { when: '${ .mode == "end" }', then: 'end' } },
                  { leave: { when: '${ .mode == "exit" }', then: 'exit' } },
                ],
              },
            },
            { inner: { set: { at: 'inner' } } },
          ],
        },
      },
      { after: { set: { at: 'after' } } },
    ]);

    const ended = await h.run(document, { mode: 'end' });
    const exited = await h.run(document, { mode: 'exit' });

    expect(outputOf(ended.outcome)).toEqual({ mode: 'end' });
    expect(outputOf(exited.outcome)).toEqual({ at: 'after' });
    expect(exited.observer.startedNamed('inner')).toHaveLength(0);
  });

  it('a_failing_when_faults_the_switch_with_an_expression_error', async () => {
    const document = aWorkflow([
      { route: { switch: [{ bad: { when: '${ .a.b }', then: 'end' } }] } },
    ]);

    const { outcome } = await h.run(document, { a: 1 });

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}expression`,
      status: 400,
      instance: '/do/0/route',
    });
  });

  // DSL 1.0.3, "Switch Case": a case without `when` "will be matched by default if no other
  // case match".
  it('a_default_case_declared_before_a_matching_case_is_taken_last', async () => {
    const document = aWorkflow([
      {
        route: {
          switch: [
            { fallback: { then: 'viaDefault' } },
            { hit: { when: '${ .kind == "x" }', then: 'viaCase' } },
          ],
        },
      },
      { viaDefault: { set: { path: 'default' }, then: 'exit' } },
      { viaCase: { set: { path: 'case' } } },
    ]);

    const { outcome } = await h.run(document, { kind: 'x' });

    expect(outputOf(outcome)).toEqual({ path: 'case' });
  });
});

describe('for', () => {
  it('each_and_at_name_the_item_and_index_and_iterations_chain_their_outputs', async () => {
    const document = aWorkflow([
      {
        loop: {
          for: { each: 'color', at: 'i', in: '${ .colors }' },
          do: [
            {
              mark: {
                set: {
                  colors: '${ .colors }',
                  seen: '${ (.seen // []) + [ { color: $color, i: $i } ] }',
                },
              },
            },
          ],
        },
      },
    ]);

    const { outcome, journal } = await h.run(document, {
      colors: ['red', 'green'],
    });

    expect(outputOf(outcome)).toEqual({
      colors: ['red', 'green'],
      seen: [
        { color: 'red', i: 0 },
        { color: 'green', i: 1 },
      ],
    });
    expect([...journal.keys()]).toEqual(
      expect.arrayContaining([
        '/do/0/loop[0]/do/0/mark',
        '/do/0/loop[1]/do/0/mark',
      ]),
    );
  });

  it('the_item_and_index_default_to_item_and_index', async () => {
    const document = aWorkflow([
      {
        loop: {
          for: { in: '${ ["a", "b"] }' },
          do: [{ mark: { set: { last: '${ $item }', at: '${ $index }' } } }],
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ last: 'b', at: 1 });
  });

  it('an_empty_collection_runs_no_iteration_and_gives_the_input', async () => {
    const document = aWorkflow([
      {
        loop: {
          for: { in: '${ .items }' },
          do: [{ mark: { set: { touched: true } } }],
        },
      },
    ]);

    const { outcome, observer } = await h.run(document, { items: [] });

    expect(outputOf(outcome)).toEqual({ items: [] });
    expect(observer.startedNamed('mark')).toHaveLength(0);
  });

  it('while_stops_the_iterations_once_it_no_longer_holds', async () => {
    const document = aWorkflow([
      {
        loop: {
          for: { in: '${ [1, 2, 3, 4, 5] }' },
          while: '${ (.sum // 0) < 3 }',
          do: [{ add: { set: { sum: '${ (.sum // 0) + $item }' } } }],
        },
      },
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ sum: 3 });
    expect(observer.endedNamed('add')).toHaveLength(2);
  });

  it('while_sees_the_current_item', async () => {
    const document = aWorkflow([
      {
        loop: {
          for: { in: '${ [1, 2, 9, 3] }' },
          while: '${ $item < 5 }',
          do: [{ add: { set: { last: '${ $item }' } } }],
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ last: 2 });
  });

  it('a_collection_that_is_not_an_array_faults_with_an_expression_error', async () => {
    const document = aWorkflow([
      {
        loop: {
          for: { in: '${ .items }' },
          do: [{ mark: { set: { x: 1 } } }],
        },
      },
    ]);

    const { outcome } = await h.run(document, { items: 'abc' });

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}expression`,
      status: 400,
      instance: '/do/0/loop',
    });
  });

  it('nested_loops_bind_their_own_variables', async () => {
    const document = aWorkflow([
      {
        rows: {
          for: { each: 'row', in: '${ [1, 2] }' },
          do: [
            {
              cols: {
                for: { each: 'col', in: '${ ["a", "b"] }' },
                do: [
                  {
                    cell: {
                      set: {
                        cells: '${ (.cells // []) + [ "\\($row)\\($col)" ] }',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ cells: ['1a', '1b', '2a', '2b'] });
  });

  it('a_fault_in_an_iteration_faults_the_loop_and_stops_it', async () => {
    const document = aWorkflow([
      {
        loop: {
          for: { in: '${ [1, 2, 3] }' },
          do: [
            {
              check: {
                if: '${ $item == 2 }',
                raise: {
                  error: { type: 'https://example.com/two', status: 409 },
                },
              },
            },
          ],
        },
      },
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: 'https://example.com/two',
      status: 409,
      instance: '/do/0/loop/do/0/check',
    });
    expect(observer.endedNamed('check')).toHaveLength(2);
  });
});

describe('fork', () => {
  it('gives_the_branch_outputs_in_branch_order_even_when_a_later_branch_ends_first', async () => {
    const pool = h.agent.get('https://fork-order.test');
    pool
      .intercept({ path: '/slow', method: 'GET' })
      .reply(200, { from: 'slow' }, { headers: JSON_HEADERS })
      .delay(300);
    pool
      .intercept({ path: '/fast', method: 'GET' })
      .reply(200, { from: 'fast' }, { headers: JSON_HEADERS });
    const document = aWorkflow([
      {
        both: {
          fork: {
            branches: [
              { slow: get('https://fork-order.test/slow') },
              { fast: get('https://fork-order.test/fast') },
              { local: { set: { from: '${ .seed }' } } },
            ],
          },
        },
      },
    ]);

    const { outcome, observer } = await h.run(document, { seed: 'set' });

    expect(outputOf(outcome)).toEqual([
      { from: 'slow' },
      { from: 'fast' },
      { from: 'set' },
    ]);
    const order = observer.ended.map((task) => task.name);
    expect(order.indexOf('fast')).toBeLessThan(order.indexOf('slow'));
  });

  it('every_branch_gets_the_fork_s_input', async () => {
    const document = aWorkflow([
      {
        both: {
          input: { from: '${ .shared }' },
          fork: {
            branches: [
              { a: { set: { a: '${ . }' } } },
              { b: { set: { b: '${ . }' } } },
            ],
          },
        },
      },
    ]);

    const { outcome } = await h.run(document, { shared: 5 });

    expect(outputOf(outcome)).toEqual([{ a: 5 }, { b: 5 }]);
  });

  it('a_faulting_branch_faults_the_fork_with_its_error', async () => {
    const document = aWorkflow([
      {
        both: {
          fork: {
            branches: [
              { ok: { set: { ok: true } } },
              {
                bad: {
                  raise: {
                    error: { type: 'https://example.com/bad', status: 418 },
                  },
                },
              },
            ],
          },
        },
      },
      { after: { set: { reached: true } } },
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: 'https://example.com/bad',
      status: 418,
      instance: '/do/0/both/fork/branches/1/bad',
    });
    expect(observer.endedNamed('both')[0]?.status).toBe(TaskStatus.Faulted);
    expect(observer.startedNamed('after')).toHaveLength(0);
  });

  it('competing_branches_give_the_output_of_a_single_branch', async () => {
    const document = aWorkflow([
      {
        race: {
          fork: {
            compete: true,
            branches: [
              {
                bad: {
                  raise: {
                    error: { type: 'https://example.com/bad', status: 500 },
                  },
                },
              },
              { good: { set: { winner: 'good' } } },
            ],
          },
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ winner: 'good' });
  });

  // DSL 1.0.3, "Fork": `compete` "Indicates whether or not the concurrent tasks are racing against
  // each other, with a single possible winner"; the winner is the first branch to complete.
  it('competing_branches_race_and_the_first_to_complete_wins', async () => {
    const pool = h.agent.get('https://fork-race.test');
    pool
      .intercept({ path: '/slow', method: 'GET' })
      .reply(200, { winner: 'slow' }, { headers: JSON_HEADERS })
      .delay(400);
    pool
      .intercept({ path: '/fast', method: 'GET' })
      .reply(200, { winner: 'fast' }, { headers: JSON_HEADERS });
    const document = aWorkflow([
      {
        race: {
          fork: {
            compete: true,
            branches: [
              { slow: get('https://fork-race.test/slow') },
              { fast: get('https://fork-race.test/fast') },
            ],
          },
        },
      },
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(observer.startedNamed('fast')).toHaveLength(1);
    expect(outputOf(outcome)).toEqual({ winner: 'fast' });
  });
});
