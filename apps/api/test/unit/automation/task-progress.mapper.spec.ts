import { DueTime } from '../../../src/domain/automation/language/due-time.js';
import { ErrorType } from '../../../src/domain/automation/language/error-type.js';
import { FlowDirective } from '../../../src/domain/automation/language/flow-directive.js';
import type { JsonValue } from '../../../src/domain/automation/language/interfaces.js';
import { Outcome } from '../../../src/domain/automation/language/outcome.js';
import { ConcludedProgress } from '../../../src/domain/automation/language/progress/concluded-progress.js';
import { EntryStage } from '../../../src/domain/automation/language/stages/entry-stage.js';
import type { TaskProgress } from '../../../src/domain/automation/language/stages/task-progress.js';
import { TaskEnding } from '../../../src/domain/automation/language/task-ending.js';
import { WorkflowName } from '../../../src/domain/automation/language/workflow-name.js';
import { InconsistentProgressError } from '../../../src/domain/errors.js';
import { OutputStage } from '../../../src/domain/automation/language/stages/output-stage.js';
import {
  EndingKind,
  TaskStage,
} from '../../../src/interface-adapters/persistence/enums.js';
import type { TaskProgressState } from '../../../src/interface-adapters/persistence/interfaces.js';
import { KindProgressMapper } from '../../../src/interface-adapters/persistence/mappers/progress/kind-progress.mapper.js';
import { TaskProgressMapper } from '../../../src/interface-adapters/persistence/mappers/progress/task-progress.mapper.js';
import {
  answer,
  completedAt,
  definitionOf,
  evaluatedAs,
  now,
  pointerOf,
  scopeOf,
} from '../../support/progress.js';

const getPetAt = '/do/0/tryGetPet/try/0/getPet';
const getPet = {
  getPet: {
    call: 'http',
    with: { method: 'get', endpoint: 'https://petstore.example/pet/1' },
  },
};

function stored<T>(state: T): T {
  const text = JSON.stringify(state);
  return JSON.parse(text) as T;
}

function notFound(): TaskEnding {
  const at = pointerOf(getPetAt);
  const error = ErrorType.Communication.errorWithStatus(404, at, null);
  return TaskEnding.faulted(error);
}

function begun(
  task: Record<string, JsonValue>,
  input: JsonValue = {},
): TaskProgress {
  const definition = definitionOf([task]);
  const name = Object.keys(task)[0] ?? '';
  const scope = scopeOf(definition, `/do/0/${name}`, input);
  return EntryStage.begin(scope).progress;
}

function tryProgress(
  tryTask: Record<string, JsonValue>,
  at: Date = now,
): TaskProgress {
  const definition = definitionOf([{ tryGetPet: tryTask }]);
  const scope = scopeOf(definition, '/do/0/tryGetPet', {}, { at });
  return EntryStage.begin(scope).progress.childEnded(
    pointerOf(getPetAt),
    notFound(),
    scope,
  ).progress;
}

const progresses: Record<string, () => TaskProgress> = {
  entry_waiting_for_its_condition: () =>
    begun({ greet: { if: '${ .go }', set: { a: 1 } } }),
  value_waiting_for_its_template: () =>
    begun({ greet: { set: { name: '${ .name }' } } }),
  call_with_its_request_and_deadline: () =>
    begun({
      getPet: {
        timeout: { after: 'PT5S' },
        call: 'http',
        with: getPet.getPet.with,
      },
    }),
  process_with_its_run: () =>
    begun({
      greet: { run: { script: { language: 'js', code: 'console.log(1)' } } },
    }),
  function_call_started: () => {
    const definition = definitionOf(
      [{ find: { call: 'getPet', with: { petId: 1 } } }],
      { functions: { getPet: getPet.getPet } },
    );
    const scope = scopeOf(definition, '/do/0/find', {});
    return EntryStage.begin(scope).progress;
  },
  run_workflow_awaiting_its_child: () => {
    const definition = definitionOf([
      {
        invoice: {
          run: {
            workflow: {
              namespace: 'billing',
              name: 'send-invoice',
              version: 'latest',
              input: { order: '${ .id }' },
            },
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/invoice', { id: 42 });
    const evaluating = EntryStage.begin(scope).progress;
    const results = answer(evaluating.work(scope), {
      evaluate: evaluatedAs(() => 42),
    });
    return evaluating.record(results, scope).progress;
  },
  do_in_the_middle_of_its_tasks: () =>
    begun({
      paint: { do: [{ a: { set: { a: 1 } } }, { b: { set: { b: 2 } } }] },
    }),
  for_in_the_middle_of_an_iteration: () => {
    const definition = definitionOf([
      { loop: { for: { in: '.items' }, do: [{ mark: { set: { a: 1 } } }] } },
    ]);
    const scope = scopeOf(definition, '/do/0/loop', { items: [1, 2] });
    const collecting = EntryStage.begin(scope).progress;
    const results = answer(collecting.work(scope), {
      evaluate: evaluatedAs(() => [1, 2]),
    });
    return collecting.record(results, scope).progress;
  },
  fork_with_one_branch_ended: () => {
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
    const bAt = '/do/0/both/fork/branches/1/b';
    const bEnded = completedAt(definition, bAt, { b: 2 });
    return EntryStage.begin(scope).progress.childEnded(
      pointerOf(bAt),
      bEnded,
      scope,
    ).progress;
  },
  switch_waiting_for_its_cases: () =>
    begun({
      pick: { switch: [{ red: { when: '.color == "red"', then: 'end' } }] },
    }),
  try_running_its_body: () =>
    begun({ tryGetPet: { try: [getPet], catch: {} } }),
  catch_waiting_for_its_condition: () =>
    tryProgress({
      try: [getPet],
      catch: { when: '${ $error.status == 404 }' },
    }),
  retry_parked_until_its_delay: () =>
    tryProgress({
      try: [getPet],
      catch: {
        retry: { delay: { seconds: 2 }, limit: { attempt: { count: 3 } } },
      },
    }),
  handler_running: () =>
    tryProgress({
      try: [getPet],
      catch: { do: [{ fallback: { set: { name: 'unknown' } } }] },
    }),
  output_waiting_for_output_as: () =>
    begun({ pick: { set: { a: 1 }, output: { as: '${ .a }' } } }),
  export_waiting_for_export_as: () =>
    begun({ pick: { set: { a: 1 }, export: { as: '${ { a: .a } }' } } }),
  export_check_waiting_for_the_context_schema: () =>
    begun({
      pick: {
        set: { a: 1 },
        export: { schema: { document: { type: 'object' } } },
      },
    }),
  ended_with_a_directive_that_ends_the_workflow: () =>
    begun({ last: { set: { a: 1 }, then: 'end' } }),
  ended_with_a_fault: () =>
    begun({
      raiseError: {
        raise: {
          error: {
            type: 'https://serverlessworkflow.io/errors/types/compliance',
            status: 400,
          },
        },
      },
    }),
};

describe('TaskProgressMapper', () => {
  it.each(Object.keys(progresses))(
    'a_stored_progress_comes_back_the_same_%s',
    (name) => {
      const progress = progresses[name]?.();

      if (progress === undefined) throw new Error(name);

      const state = TaskProgressMapper.toState(progress);
      const restored = TaskProgressMapper.toDomain(stored(state));

      expect(restored.constructor).toBe(progress.constructor);
      expect(TaskProgressMapper.toState(restored)).toEqual(stored(state));
    },
  );

  it('the_examples_cover_every_stage_and_every_kind_of_progress', () => {
    const shapes = Object.values(progresses).map((build) => {
      const state = TaskProgressMapper.toState(build());

      if (state.stage !== TaskStage.Body) return state.stage;

      return `${state.stage}/${state.body.kind}`;
    });

    expect(shapes).toEqual([
      'entry',
      'body/value',
      'body/call',
      'body/process',
      'body/function-call',
      'body/run-workflow',
      'body/do',
      'body/for',
      'body/fork',
      'body/switch',
      'body/try',
      'body/catch',
      'body/retry',
      'body/handler',
      'output',
      'export',
      'export-check',
      'ended',
      'ended',
    ]);
  });

  it('a_restored_retry_runs_the_body_again_when_its_delay_is_due', () => {
    const tryTask = {
      try: [getPet],
      catch: {
        retry: { delay: { seconds: 2 }, limit: { attempt: { count: 3 } } },
      },
    };
    const definition = definitionOf([{ tryGetPet: tryTask }]);
    const parked = tryProgress(tryTask);
    const state = TaskProgressMapper.toState(parked);
    const restored = TaskProgressMapper.toDomain(stored(state));
    const due = new Date(now.getTime() + 2000);
    const scope = scopeOf(definition, '/do/0/tryGetPet', {}, { at: due });

    const retried = restored.record(answer(restored.work(scope), {}), scope);

    expect(restored.wakeAt().time).toEqual(due);
    expect(retried.starts.map((start) => start.reference.toString())).toEqual([
      getPetAt,
    ]);
  });

  it('a_restored_fork_joins_when_its_last_branch_ends', () => {
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
    const half = progresses.fork_with_one_branch_ended?.();

    if (half === undefined) throw new Error('fork');

    const state = TaskProgressMapper.toState(half);
    const restored = TaskProgressMapper.toDomain(stored(state));
    const aAt = '/do/0/both/fork/branches/0/a';
    const ending = restored
      .childEnded(pointerOf(aAt), completedAt(definition, aAt, { a: 1 }), scope)
      .progress.ending();

    expect(ending?.output).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('an_outcome_keeps_its_directive_and_detached_workflow', () => {
    const workflow = new WorkflowName('billing', 'archive');
    const detached = Outcome.detachingWorkflow(
      { id: 1 },
      { workflow, versionId: 'version-1', input: {} },
    );
    const ended = Outcome.directed({ id: 1 }, FlowDirective.End);

    const states = [detached, ended].map((outcome) => {
      const stage = new OutputStage({
        input: {},
        deadline: DueTime.None,
        outcome,
      });
      const state = TaskProgressMapper.toState(stage);
      const restored = TaskProgressMapper.toDomain(stored(state));

      if (!(restored instanceof OutputStage)) throw new Error('stage');

      return restored.outcome;
    });

    expect(states[0]?.detachedWorkflow?.workflow.toString()).toBe(
      'billing/archive',
    );
    expect(states[0]?.detachedWorkflow?.versionId).toBe('version-1');
    expect(states[1]?.directive).toBe(FlowDirective.End);
  });

  it('a_body_that_ended_is_never_stored', () => {
    const outcome = Outcome.of({ id: 1 });
    const concluded = new ConcludedProgress(outcome);
    const store = () => KindProgressMapper.toState(concluded);

    expect(store).toThrow(InconsistentProgressError);
  });

  it('a_stage_the_platform_does_not_know_is_refused_by_name', () => {
    const state = { stage: 'paused' } as unknown as TaskProgressState;
    const restore = () => TaskProgressMapper.toDomain(state);

    expect(restore).toThrow(InconsistentProgressError);
  });

  it('a_faulted_ending_is_restored_from_its_error_alone', () => {
    const failure = {
      type: 'https://serverlessworkflow.io/spec/1.0.0/errors/runtime',
      status: 500,
      instance: '/do/0/greet',
      title: null,
      detail: null,
    };
    const state: TaskProgressState = {
      stage: TaskStage.Ended,
      ending: { kind: EndingKind.Faulted, failure },
    };
    const ending = TaskProgressMapper.toDomain(state).ending();

    expect(ending?.failure?.status).toBe(500);
  });
});
