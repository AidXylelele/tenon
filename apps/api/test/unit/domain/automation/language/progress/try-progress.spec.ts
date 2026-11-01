import { ErrorType } from '../../../../../../src/domain/automation/language/error-type.js';
import { EntryStage } from '../../../../../../src/domain/automation/language/stages/entry-stage.js';
import { TaskEnding } from '../../../../../../src/domain/automation/language/task-ending.js';
import {
  answer,
  completedAt,
  definitionOf,
  evaluatedAs,
  now,
  pointerOf,
  scopeOf,
} from '../../../../../support/progress.js';

const getPetAt = '/do/0/tryGetPet/try/0/getPet';
const getPet = {
  getPet: {
    call: 'http',
    with: { method: 'get', endpoint: 'https://petstore.example/pet/1' },
  },
};

function notFound(): TaskEnding {
  const at = pointerOf(getPetAt);
  const error = ErrorType.Communication.errorWithStatus(404, at, null);
  return TaskEnding.faulted(error);
}

describe('TryProgress', () => {
  it('a_caught_error_runs_the_handler_with_the_error_under_its_name', () => {
    const definition = definitionOf([
      {
        tryGetPet: {
          try: [getPet],
          catch: {
            errors: { with: { status: 404 } },
            as: 'err',
            do: [{ setError: { set: { error: '${ $err }' } } }],
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/tryGetPet', {});
    const trying = EntryStage.begin(scope).progress;

    const handling = trying.childEnded(pointerOf(getPetAt), notFound(), scope);

    expect(handling.starts).toEqual([
      expect.objectContaining({
        variables: {
          err: {
            type: 'https://serverlessworkflow.io/spec/1.0.0/errors/communication',
            status: 404,
            instance: getPetAt,
            title: 'Communication Error',
          },
        },
      }),
    ]);
  });

  it('an_error_the_filter_does_not_match_faults_the_try_task', () => {
    const definition = definitionOf([
      {
        tryGetPet: {
          try: [getPet],
          catch: { errors: { with: { status: 503 } } },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/tryGetPet', {});
    const trying = EntryStage.begin(scope).progress;

    const ending = trying
      .childEnded(pointerOf(getPetAt), notFound(), scope)
      .progress.ending();

    expect(ending?.failure?.status).toBe(404);
  });

  it('a_caught_error_without_a_handler_completes_with_the_try_input', () => {
    const definition = definitionOf([
      { tryGetPet: { try: [getPet], catch: { errors: {} } } },
    ]);
    const scope = scopeOf(definition, '/do/0/tryGetPet', { petId: 1 });
    const trying = EntryStage.begin(scope).progress;

    const ending = trying
      .childEnded(pointerOf(getPetAt), notFound(), scope)
      .progress.ending();

    expect(ending?.output).toEqual({ petId: 1 });
  });

  it('a_catch_when_condition_sees_the_error_and_decides_the_catch', () => {
    const definition = definitionOf([
      {
        tryGetPet: {
          try: [getPet],
          catch: { when: '${ $error.status == 503 }' },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/tryGetPet', {});
    const catching = EntryStage.begin(scope).progress.childEnded(
      pointerOf(getPetAt),
      notFound(),
      scope,
    ).progress;

    const work = catching.work(scope);
    const ending = catching
      .record(answer(work, { evaluate: evaluatedAs(() => false) }), scope)
      .progress.ending();

    expect(work.evaluations[0]?.arguments).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ status: 404 }),
      }),
    );
    expect(ending?.failure?.status).toBe(404);
  });

  it('a_retry_parks_the_task_for_its_delay_and_then_runs_the_body_again', () => {
    const definition = definitionOf([
      {
        tryGetPet: {
          try: [getPet],
          catch: {
            retry: {
              delay: { seconds: 2 },
              backoff: { exponential: {} },
              limit: { attempt: { count: 3 } },
            },
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/tryGetPet', {});
    const parked = EntryStage.begin(scope).progress.childEnded(
      pointerOf(getPetAt),
      notFound(),
      scope,
    ).progress;
    const early = scopeOf(
      definition,
      '/do/0/tryGetPet',
      {},
      {
        at: new Date(now.getTime() + 1000),
      },
    );
    const due = scopeOf(
      definition,
      '/do/0/tryGetPet',
      {},
      {
        at: new Date(now.getTime() + 2000),
      },
    );

    const waiting = parked.record(answer(parked.work(early), {}), early);
    const retried = parked.record(answer(parked.work(due), {}), due);

    expect(parked.wakeAt()).toEqual(new Date(now.getTime() + 2000));
    expect(waiting.starts).toEqual([]);
    expect(retried.starts.map((start) => start.reference.toString())).toEqual([
      getPetAt,
    ]);
    expect(retried.progress.wakeAt()).toBeNull();
  });

  it('spent_retries_fault_the_try_task_with_the_last_error', () => {
    const definition = definitionOf([
      {
        tryGetPet: {
          try: [getPet],
          catch: { retry: { limit: { attempt: { count: 0 } } } },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/tryGetPet', { petId: 1 });

    const ending = EntryStage.begin(scope)
      .progress.childEnded(pointerOf(getPetAt), notFound(), scope)
      .progress.ending();

    expect(ending?.failure?.status).toBe(404);
  });

  it('spent_retries_run_the_handler_when_the_catch_has_one', () => {
    const definition = definitionOf([
      {
        tryGetPet: {
          try: [getPet],
          catch: {
            retry: { limit: { attempt: { count: 0 } } },
            do: [{ fallback: { set: { name: 'unknown' } } }],
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/tryGetPet', {});

    const handling = EntryStage.begin(scope).progress.childEnded(
      pointerOf(getPetAt),
      notFound(),
      scope,
    );

    expect(handling.starts.map((start) => start.reference.toString())).toEqual([
      '/do/0/tryGetPet/catch/do/0/fallback',
    ]);
  });
});

describe('TryProgress while its handler runs', () => {
  it('a_running_handler_asks_for_nothing_and_ends_the_try_with_its_output', () => {
    const definition = definitionOf([
      {
        tryGetPet: {
          try: [getPet],
          catch: {
            when: '${ $error.status == 404 }',
            do: [{ fallback: { set: { name: 'unknown' } } }],
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/tryGetPet', {});
    const catching = EntryStage.begin(scope).progress.childEnded(
      pointerOf(getPetAt),
      notFound(),
      scope,
    ).progress;
    const handling = catching.record(
      answer(catching.work(scope), { evaluate: evaluatedAs(() => true) }),
      scope,
    );
    const fallbackAt = '/do/0/tryGetPet/catch/do/0/fallback';

    const again = handling.progress.record(
      answer(handling.progress.work(scope), {}),
      scope,
    );
    const ending = handling.progress
      .childEnded(
        pointerOf(fallbackAt),
        completedAt(definition, fallbackAt, { name: 'unknown' }),
        scope,
      )
      .progress.ending();

    expect(handling.starts.map((start) => start.reference.toString())).toEqual([
      fallbackAt,
    ]);
    expect(handling.progress.work(scope).isEmpty()).toBe(true);
    expect(again.starts).toEqual([]);
    expect(ending?.output).toEqual({ name: 'unknown' });
  });
});
