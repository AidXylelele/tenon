import { RunDirective } from '../../../src/domain/automation/instances/enums.js';
import type { JsonObject } from '../../../src/domain/automation/json.js';
import { RunOutcomeKind } from '../../../src/interface-adapters/workflows/enums.js';
import type { RunOutcome } from '../../../src/interface-adapters/workflows/interfaces.js';
import {
  DuplicateStepName,
  InMemoryDurability,
  type Journal,
  JSON_HEADERS,
  RecordingObserver,
  RuntimeHarness,
  SimulatedCrash,
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

function stopAt(name: string, directive: RunDirective = RunDirective.Stop) {
  return new RecordingObserver((task) =>
    task.name === name ? directive : RunDirective.Continue,
  );
}

const SEQUENCE = aWorkflow([
  { a: { set: { step: 'a' } } },
  { b: { set: { step: 'b' } } },
]);

describe('the in-memory durability', () => {
  it('refuses_a_name_used_twice_in_one_run_and_replays_a_journaled_step', async () => {
    const journal: Journal = new Map();
    const first = new InMemoryDurability(journal, { start: 0 });
    const options = { timeoutMs: null, retry: null };
    let runs = 0;
    const effect = () => {
      runs += 1;
      return Promise.resolve(runs);
    };

    expect(await first.step('x', effect, options)).toBe(1);
    await expect(first.step('x', effect, options)).rejects.toBeInstanceOf(
      DuplicateStepName,
    );
    const second = new InMemoryDurability(journal, { start: 0 });
    expect(await second.step('x', effect, options)).toBe(1);
    expect(runs).toBe(1);
  });
});

describe('the platform s directives', () => {
  it('stop_after_a_task_stops_the_run_before_the_next_task', async () => {
    const { outcome, observer } = await h.run(
      SEQUENCE,
      {},
      {
        observer: stopAt('a'),
      },
    );

    expect(outcome).toEqual({ kind: RunOutcomeKind.Stopped });
    expect(observer.startedNamed('b')).toHaveLength(0);
  });

  it.each([
    [
      'a_nested_do',
      { outer: { do: [{ a: { set: { x: 1 } } }, { c: { set: { x: 2 } } }] } },
    ],
    [
      'a_for_loop',
      { outer: { for: { in: '${ [1, 2] }' }, do: [{ a: { set: { x: 1 } } }] } },
    ],
    ['a_try', { outer: { try: [{ a: { set: { x: 1 } } }], catch: {} } }],
    ['a_function', { outer: { call: 'fn' } }],
  ])('stop_inside_%s_stops_the_whole_run', async (_name, task) => {
    const document = aWorkflow([task, { after: { set: { reached: true } } }], {
      use: { functions: { fn: { do: [{ a: { set: { x: 1 } } }] } } },
    });

    const { outcome, observer } = await h.run(
      document,
      {},
      {
        observer: stopAt('a'),
      },
    );

    expect(outcome).toEqual({ kind: RunOutcomeKind.Stopped });
    expect(observer.startedNamed('after')).toHaveLength(0);
    expect(observer.endedNamed('a')).toHaveLength(1);
  });

  it('stop_on_a_faulted_task_in_a_try_stops_the_run_before_the_catch', async () => {
    const document = aWorkflow([
      {
        guarded: {
          try: [
            {
              fail: {
                raise: {
                  error: { type: 'https://example.com/x', status: 400 },
                },
              },
            },
          ],
          catch: { do: [{ handle: { set: { handled: true } } }] },
        },
      },
    ]);

    const { outcome, observer } = await h.run(
      document,
      {},
      {
        observer: stopAt('fail'),
      },
    );

    expect(outcome).toEqual({ kind: RunOutcomeKind.Stopped });
    expect(observer.startedNamed('handle')).toHaveLength(0);
  });

  it('suspend_holds_the_run_until_the_platform_answers_continue', async () => {
    const observer = new RecordingObserver(
      (task) =>
        task.name === 'a' ? RunDirective.Suspend : RunDirective.Continue,
      [RunDirective.Continue],
    );

    const { outcome, durability } = await h.run(SEQUENCE, {}, { observer });

    expect(outputOf(outcome)).toEqual({ step: 'b' });
    expect(durability.newWaits.map((w) => w.name)).toEqual(['/do/0/a@resume1']);
    expect(observer.directiveCalls).toBe(1);
    expect(observer.events.indexOf('directive continue')).toBeLessThan(
      observer.events.indexOf('start /do/1/b'),
    );
  });

  it('a_suspended_run_asked_again_waits_again_under_a_new_name', async () => {
    const observer = new RecordingObserver(
      (task) =>
        task.name === 'a' ? RunDirective.Suspend : RunDirective.Continue,
      [RunDirective.Suspend, RunDirective.Suspend, RunDirective.Continue],
    );

    const { outcome, durability } = await h.run(SEQUENCE, {}, { observer });

    expect(outputOf(outcome)).toEqual({ step: 'b' });
    expect(durability.newWaits.map((w) => w.name)).toEqual([
      '/do/0/a@resume1',
      '/do/0/a@resume2',
      '/do/0/a@resume3',
    ]);
  });

  it('a_suspended_run_that_is_stopped_meanwhile_stops', async () => {
    const observer = new RecordingObserver(
      (task) =>
        task.name === 'a' ? RunDirective.Suspend : RunDirective.Continue,
      [RunDirective.Stop],
    );

    const { outcome } = await h.run(SEQUENCE, {}, { observer });

    expect(outcome).toEqual({ kind: RunOutcomeKind.Stopped });
    expect(observer.startedNamed('b')).toHaveLength(0);
  });

  it('suspend_at_the_end_of_a_composite_holds_the_run_there', async () => {
    const document = aWorkflow([
      { outer: { do: [{ a: { set: { x: 1 } } }] } },
      { b: { set: { x: 2 } } },
    ]);
    const observer = new RecordingObserver(
      (task) =>
        task.name === 'outer' ? RunDirective.Suspend : RunDirective.Continue,
      [RunDirective.Continue],
    );

    const { durability } = await h.run(document, {}, { observer });

    expect(durability.newWaits.map((w) => w.name)).toEqual([
      '/do/0/outer@resume1',
    ]);
  });

  // A stopped instance is cancelled: the runtime must not start further tasks of it.
  it('a_stop_in_one_fork_branch_starts_no_task_of_the_others', async () => {
    const document = aWorkflow([
      {
        both: {
          fork: {
            branches: [
              { a: { set: { x: 1 } } },
              {
                long: {
                  do: [
                    { b1: { set: { y: 1 } } },
                    { b2: { set: { y: 2 } } },
                    { b3: { set: { y: 3 } } },
                    { b4: { set: { y: 4 } } },
                  ],
                },
              },
            ],
          },
        },
      },
    ]);
    const observer = stopAt('a');

    const { outcome } = await h.run(document, {}, { observer });

    expect(outcome).toEqual({ kind: RunOutcomeKind.Stopped });
    const stoppedAt = observer.events.indexOf(
      'end /do/0/both/fork/branches/0/a completed',
    );
    const startedLater = observer.events
      .slice(stoppedAt + 1)
      .filter((event) => event.startsWith('start'));
    expect(startedLater).toEqual([]);
  });
});

describe('replay', () => {
  function counted(origin: string): { count: number } {
    const counter = { count: 0 };
    h.agent
      .get(origin)
      .intercept({ path: '/n', method: 'GET' })
      .reply(() => {
        counter.count += 1;
        return {
          statusCode: 200,
          data: JSON.stringify({ n: 5 }),
          responseOptions: { headers: JSON_HEADERS },
        };
      })
      .persist();
    return counter;
  }

  // Every kind of step the runtime journals: data flow, an HTTP call, a loop, a wait, a fork, a
  // retried try, a switch back-jump, an emit with its id given, a function and a sub-workflow.
  function kitchenSink(origin: string): JsonObject {
    return aWorkflow(
      [
        { init: { set: { n: 0 }, export: { as: '${ { seen: [] } }' } } },
        {
          fetch: {
            call: 'http',
            with: { method: 'get', endpoint: `${origin}/n` },
            output: { as: '${ { n: .n, items: [1, 2] } }' },
          },
        },
        {
          loop: {
            for: { in: '${ .items }' },
            do: [
              {
                add: {
                  set: { n: '${ .n + $item }', items: '${ .items }' },
                  export: { as: '${ { seen: ($context.seen + [ $item ]) } }' },
                },
              },
            ],
          },
        },
        { pause: { wait: { seconds: 1 } } },
        {
          branch: {
            fork: {
              branches: [
                { left: { set: { left: '${ .n }' } } },
                { right: { call: 'double', with: { v: '${ .n }' } } },
              ],
            },
            output: { as: '${ { n: (.[0].left + .[1].v), rounds: 0 } }' },
          },
        },
        {
          guarded: {
            try: [
              {
                fail: {
                  raise: {
                    error: { type: 'https://example.com/x', status: 503 },
                  },
                },
              },
            ],
            catch: {
              retry: {
                delay: { seconds: 1 },
                limit: { attempt: { count: 2 } },
              },
              do: [
                { recover: { set: { n: '${ .n }', rounds: '${ .rounds }' } } },
              ],
            },
          },
        },
        { again: { set: { n: '${ .n }', rounds: '${ .rounds + 1 }' } } },
        {
          route: {
            switch: [{ loopBack: { when: '${ .rounds < 2 }', then: 'again' } }],
          },
        },
        {
          announce: {
            emit: {
              event: {
                with: {
                  id: 'fixed-id',
                  time: '2026-01-01T00:00:00Z',
                  source: 'https://qa.test',
                  type: 'qa.done',
                  data: { n: '${ .n }' },
                },
              },
            },
            output: { as: '${ .data }' },
          },
        },
        {
          sub: {
            run: {
              workflow: {
                namespace: 'qa',
                name: 'child',
                version: '1.0.0',
                input: { n: '${ .n }' },
              },
            },
            output: { as: '${ { child: . } }' },
          },
        },
        { final: { set: { result: '${ . }', context: '${ $context }' } } },
      ],
      {
        use: {
          functions: { double: { set: { v: '${ .v * 2 }' } } },
        },
      },
    );
  }

  it('a_second_run_on_the_same_journal_replays_the_outcome_and_runs_no_effect', async () => {
    const counter = counted('https://replay-full.test');
    const document = kitchenSink('https://replay-full.test');

    const first = await h.run(document, {});
    const keys = [...first.journal.keys()];
    const second = await h.run(document, {}, { journal: first.journal });

    expect(first.outcome.kind).toBe(RunOutcomeKind.Completed);
    expect(second.outcome).toEqual(first.outcome);
    expect(second.durability.executed).toEqual([]);
    expect(second.durability.backoffs).toEqual([]);
    expect(second.durability.calls.every((call) => call.replayed)).toBe(true);
    expect(second.observer.events).toEqual([]);
    expect(counter.count).toBe(1);
    expect([...second.journal.keys()]).toEqual(keys);
  });

  it('a_run_resumed_after_a_crash_before_any_step_ends_as_an_uninterrupted_run', async () => {
    counted('https://replay-reference.test');
    const reference = await h.run(
      kitchenSink('https://replay-reference.test'),
      {},
    );
    expect(reference.outcome.kind).toBe(RunOutcomeKind.Completed);
    const steps = reference.durability.calls
      .filter((call) => call.kind === 'step' && !call.replayed)
      .map((call) => call.name);
    expect(steps.length).toBeGreaterThan(30);

    for (const [index, crashed] of steps.entries()) {
      const origin = `https://replay-crash-${String(index)}.test`;
      const counter = counted(origin);
      const document = kitchenSink(origin);
      const journal: Journal = new Map();

      const crashedRun = h.run(
        document,
        {},
        {
          journal,
          crashBefore: (name) => name === crashed,
        },
      );
      await expect(crashedRun).rejects.toBeInstanceOf(SimulatedCrash);
      const resumed = await h.run(document, {}, { journal });

      expect(resumed.outcome, `crash before ${crashed}`).toEqual(
        reference.outcome,
      );
      expect(counter.count, `crash before ${crashed}`).toBe(1);
    }
  });

  it('a_replayed_suspension_asks_the_platform_nothing', async () => {
    const observer = new RecordingObserver(
      (task) =>
        task.name === 'a' ? RunDirective.Suspend : RunDirective.Continue,
      [RunDirective.Suspend, RunDirective.Continue],
    );
    const first = await h.run(SEQUENCE, {}, { observer });

    const second = await h.run(SEQUENCE, {}, { journal: first.journal });

    expect(second.outcome).toEqual(first.outcome);
    expect(second.observer.directiveCalls).toBe(0);
    expect(second.durability.newWaits).toEqual([]);
  });

  it('a_resumed_race_keeps_the_branch_that_won_live', async () => {
    h.agent
      .get('https://replay-race.test')
      .intercept({ path: '/slow', method: 'GET' })
      .reply(200, { winner: 'slow' }, { headers: JSON_HEADERS })
      .delay(200)
      .persist();
    const document = aWorkflow([
      {
        race: {
          fork: {
            compete: true,
            branches: [
              {
                slow: {
                  call: 'http',
                  with: {
                    method: 'get',
                    endpoint: 'https://replay-race.test/slow',
                  },
                },
              },
              {
                fast: {
                  do: [
                    { one: { set: { winner: 'fast' } } },
                    { two: { set: { winner: 'fast' } } },
                  ],
                },
              },
            ],
          },
        },
      },
      { read: { set: { won: '${ .winner }' } } },
    ]);
    const reference = await h.run(document, {});
    const journal: Journal = new Map();

    await expect(
      h.run(
        document,
        {},
        { journal, crashBefore: (name) => name === '/do/1/read' },
      ),
    ).rejects.toBeInstanceOf(SimulatedCrash);
    const resumed = await h.run(document, {}, { journal });

    expect(outputOf(reference.outcome)).toEqual({ won: 'fast' });
    expect(resumed.outcome).toEqual(reference.outcome);
    // Only what follows the crash runs again: the race's winner and both branches replay.
    const fresh = resumed.durability.calls
      .filter((call) => !call.replayed)
      .map((call) => call.name);
    expect(fresh).toEqual(['/do/1/read', '/@output']);
  });

  it('a_replayed_emit_keeps_its_generated_id_and_publishes_nothing_again', async () => {
    const document = aWorkflow([
      {
        announce: {
          emit: {
            event: { with: { source: 'https://qa.test', type: 'qa.done' } },
          },
        },
      },
    ]);
    const first = await h.run(document, {});

    const second = await h.run(document, {}, { journal: first.journal });

    expect(second.outcome).toEqual(first.outcome);
    expect(first.observer.emittedEvents).toHaveLength(1);
    expect(second.observer.emittedEvents).toHaveLength(0);
  });

  // Each branch keeps its own context, applied after the fork in branch order: the last declared
  // branch that exports wins live and on a replay alike, whichever finished last.
  it('a_fork_whose_branches_export_resumes_with_the_same_context', async () => {
    h.agent
      .get('https://replay-fork.test')
      .intercept({ path: '/slow', method: 'GET' })
      .reply(200, { slow: true }, { headers: JSON_HEADERS })
      .delay(200)
      .persist();
    const document = aWorkflow([
      {
        both: {
          fork: {
            branches: [
              {
                slow: {
                  call: 'http',
                  with: {
                    method: 'get',
                    endpoint: 'https://replay-fork.test/slow',
                  },
                  export: { as: '${ { winner: "slow" } }' },
                },
              },
              {
                fast: {
                  set: { fast: true },
                  export: { as: '${ { winner: "fast" } }' },
                },
              },
            ],
          },
        },
      },
      { read: { set: { winner: '${ $context.winner }' } } },
    ]);
    const reference = await h.run(document, {});
    const journal: Journal = new Map();

    await expect(
      h.run(
        document,
        {},
        { journal, crashBefore: (name) => name === '/do/1/read' },
      ),
    ).rejects.toBeInstanceOf(SimulatedCrash);
    const resumed = await h.run(document, {}, { journal });

    expect(outputOf(reference.outcome)).toEqual({ winner: 'fast' });
    expect(resumed.outcome).toEqual(reference.outcome);
  });
});
