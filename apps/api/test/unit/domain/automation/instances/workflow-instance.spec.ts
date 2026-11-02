import { EventOriginKind } from '../../../../../src/domain/automation/events/enums.js';
import { ProcessDetached } from '../../../../../src/domain/automation/instances/domain-events/process-detached.js';
import { WorkflowDetached } from '../../../../../src/domain/automation/instances/domain-events/workflow-detached.js';
import { InstanceProgressKind } from '../../../../../src/domain/automation/instances/enums.js';
import { WorkflowInstance } from '../../../../../src/domain/automation/instances/workflow-instance.js';
import { RunnableVersion } from '../../../../../src/domain/automation/workflows/runnable-version.js';
import type { Definition } from '../../../../../src/domain/automation/language/definition.js';
import type { JsonObject } from '../../../../../src/domain/automation/language/interfaces.js';
import { ErrorType } from '../../../../../src/domain/automation/language/error-type.js';
import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { Phase } from '../../../../../src/domain/automation/language/phase.js';
import { ServiceResponded } from '../../../../../src/domain/automation/language/results/service-responded.js';
import { ValidationFailed } from '../../../../../src/domain/automation/language/results/validation-failed.js';
import {
  roundAt,
  published,
  settle,
  started,
  typesOf,
} from '../../../../support/instances.js';
import {
  definitionOf,
  evaluatedAs,
  now,
} from '../../../../support/progress.js';
import {
  InconsistentProgressError,
  StaleRoundError,
} from '../../../../../src/domain/errors.js';

const later = (seconds: number): Date => {
  const time = now.getTime() + seconds * 1000;
  return new Date(time);
};

const call = (endpoint: string) => ({
  call: 'http',
  with: { method: 'get', endpoint },
});

const ok = (id: string): ServiceResponded =>
  new ServiceResponded({
    id,
    status: 200,
    headers: {},
    content: { id },
    body: '',
    request: {},
    authorization: null,
  });

const failing = {
  type: 'https://serverlessworkflow.io/spec/1.0.0/errors/runtime',
  status: 500,
  title: 'Boom',
};

describe('WorkflowInstance', () => {
  it('an_instance_is_created_pending_with_an_empty_input_when_none_is_given', () => {
    const definition = definitionOf([{ first: { set: { a: 1 } } }]);

    const instance = started(definition, undefined);

    expect(instance.phase).toBe(Phase.Pending);
    expect(instance.input).toEqual({});
    expect(instance.progress(now).kind).toBe(InstanceProgressKind.Run);
  });

  it('an_instance_runs_its_tasks_in_order_and_completes_with_the_last_output', () => {
    const definition = definitionOf([
      { first: { set: { a: 1 } } },
      { second: { set: { b: 2 } } },
    ]);
    const instance = started(definition);

    instance.beginRound(roundAt(definition, now));

    expect(instance.phase).toBe(Phase.Completed);
    expect(instance.output).toEqual({ b: 2 });
    expect(instance.endedAt).toEqual(now);
    expect(typesOf(instance)).toEqual([
      'workflow.started',
      'task.created',
      'task.started',
      'task.completed',
      'task.created',
      'task.started',
      'task.completed',
      'workflow.completed',
    ]);
    expect(instance.progress(now).kind).toBe(InstanceProgressKind.Ended);
  });

  it('lifecycle_events_carry_the_standard_shape_in_the_order_of_changes', () => {
    const definition = definitionOf([{ first: { set: { a: 1 } } }]);
    const instance = started(definition);

    instance.beginRound(roundAt(definition, now));
    const [started_, created] = instance.takeProducedEvents();

    expect(started_?.source).toBe(
      `/workflows/default/test/instances/${instance.id}`,
    );
    expect(started_?.eventId).toBe('1');
    expect(started_?.sequence).toBe(1);
    expect(started_?.data).toEqual({
      name: `test-${instance.id}.default`,
      definition: { name: 'test', namespace: 'default', version: '1.0.0' },
      startedAt: now.toISOString(),
    });
    expect(created?.data).toEqual({
      workflow: `test-${instance.id}.default`,
      task: '/do/0/first',
      createdAt: now.toISOString(),
    });
    expect(created?.origin).toEqual({
      kind: EventOriginKind.Lifecycle,
      workflowId: instance.workflowId,
      instanceId: instance.id,
    });
  });

  it('an_input_that_breaks_the_input_schema_faults_the_instance_with_a_validation_error', () => {
    const definition = definitionOf(
      [{ first: { set: { a: 1 } } }],
      {},
      {
        schema: {
          format: 'json',
          document: { type: 'object', required: ['orderId'] },
        },
      },
    );
    const instance = started(definition, {});

    instance.beginRound(roundAt(definition, now));
    settle(instance, definition, now, {
      validate: (id) => new ValidationFailed(id, 'orderId is required'),
    });

    expect(instance.phase).toBe(Phase.Faulted);
    expect(instance.error?.status).toBe(400);
    expect(instance.error?.type).toBe(
      ErrorType.Validation.errorAt(JsonPointer.root(), null).type,
    );
  });

  it('an_uncaught_raised_error_faults_the_instance_with_that_error_at_its_task', () => {
    const definition = definitionOf([{ fail: { raise: { error: failing } } }]);
    const instance = started(definition);

    instance.beginRound(roundAt(definition, now));

    expect(instance.phase).toBe(Phase.Faulted);
    expect(instance.error?.toJson()).toEqual({
      type: failing.type,
      status: 500,
      title: 'Boom',
      instance: '/do/0/fail',
    });
    expect(typesOf(instance)).toEqual([
      'workflow.started',
      'task.created',
      'task.started',
      'task.faulted',
      'workflow.faulted',
    ]);
  });

  it('a_skipped_task_produces_no_lifecycle_event_and_passes_its_input_on', () => {
    const definition = definitionOf([
      { skipped: { if: '${ false }', set: { a: 1 } } },
    ]);
    const instance = started(definition, { kept: true });

    instance.beginRound(roundAt(definition, now));
    settle(instance, definition, now, {
      evaluate: evaluatedAs(() => false),
    });

    expect(instance.output).toEqual({ kept: true });
    expect(typesOf(instance)).toEqual([
      'workflow.started',
      'workflow.completed',
    ]);
  });

  it('a_retry_parks_the_instance_until_its_delay_and_spent_retries_fault_it', () => {
    const definition = definitionOf([
      {
        attempt: {
          try: [{ fail: { raise: { error: failing } } }],
          catch: {
            errors: { with: { status: 500 } },
            retry: {
              delay: { seconds: 1 },
              limit: { attempt: { count: 2 } },
            },
          },
        },
      },
    ]);
    const instance = started(definition);

    instance.beginRound(roundAt(definition, now));
    const parked = instance.progress(now);
    instance.beginRound(roundAt(definition, later(1)));
    instance.beginRound(roundAt(definition, later(2)));
    const types = typesOf(instance);

    expect(parked).toEqual({
      kind: InstanceProgressKind.Park,
      wakeAt: later(1),
      subWorkflows: [],
    });
    expect(instance.phase).toBe(Phase.Faulted);
    expect(instance.error?.title).toBe('Boom');
    expect(types.filter((type) => type === 'task.retried')).toHaveLength(2);
    expect(
      instance.tasks.find((task) => task.name === 'attempt')?.retries,
    ).toBe(2);
  });

  it('an_elapsed_task_timeout_faults_the_task_and_the_instance_with_a_timeout_error', () => {
    const definition = definitionOf([
      {
        slow: {
          timeout: { after: { seconds: 5 } },
          ...call('https://slow.example/'),
        },
      },
    ]);
    const instance = started(definition);

    instance.beginRound(roundAt(definition, now));
    const waiting = instance.progress(now);
    instance.beginRound(roundAt(definition, later(5)));

    expect(waiting.wakeAt).toEqual(later(5));
    expect(instance.phase).toBe(Phase.Faulted);
    expect(instance.error?.status).toBe(408);
    expect(instance.error?.instance).toBe('/do/0/slow');
  });

  it('a_competing_fork_takes_the_first_branch_and_cancels_the_others', () => {
    const definition = definitionOf([
      {
        race: {
          fork: {
            compete: true,
            branches: [
              { a: call('https://a.example/') },
              { b: call('https://b.example/') },
            ],
          },
        },
      },
    ]);
    const instance = started(definition);
    instance.beginRound(roundAt(definition, now));
    const work = instance.pendingWork(roundAt(definition, now));
    const first = work.calls[0];

    if (first === undefined) throw new Error('call');

    settle(instance, definition, now, {
      respond: (id) => ok(id),
    });
    instance.takeProducedEvents();

    expect(work.calls).toHaveLength(2);
    expect(instance.phase).toBe(Phase.Completed);
    expect(instance.output).toEqual({ id: first.id });
    expect(
      instance.tasks.filter((task) => task.phase === Phase.Cancelled),
    ).toHaveLength(1);
  });

  it('an_emit_task_produces_its_event_in_the_change_that_records_it', () => {
    const definition = definitionOf([
      {
        notify: {
          emit: {
            event: {
              with: {
                source: 'https://orders.example',
                type: 'order.placed',
                data: { id: 1 },
                traceid: 'abc',
              },
            },
          },
        },
      },
    ]);
    const instance = started(definition);

    instance.beginRound(roundAt(definition, now));
    const emitted = instance
      .takeProducedEvents()
      .find((event) => event.origin.kind === EventOriginKind.Emit);

    expect(emitted?.type).toBe('order.placed');
    expect(emitted?.data).toEqual({ id: 1 });
    expect(emitted?.extensions).toEqual({ traceid: 'abc' });
    expect(emitted?.sequence).toBe(4);
  });

  it('a_process_not_awaited_is_detached_once_from_the_ending_task', () => {
    const definition = definitionOf([
      { greet: { run: { shell: { command: 'echo hi' }, await: false } } },
    ]);
    const instance = started(definition);

    instance.beginRound(roundAt(definition, now));
    const events = instance.takeDomainEvents();
    const again = instance.takeDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ProcessDetached);
    expect(events[0]?.instanceId).toBe(instance.id);
    expect(again).toHaveLength(0);
  });

  describe('sub-workflows', () => {
    const definition = definitionOf([
      {
        invoice: {
          run: {
            workflow: {
              namespace: 'billing',
              name: 'send-invoice',
              version: '1.0.0',
            },
          },
        },
      },
    ]);
    const child = definitionOf(
      [{ send: { set: { sent: true } } }],
      {},
      null,
      'billing/send-invoice',
    );
    const failingChild = definitionOf(
      [{ fail: { raise: { error: failing } } }],
      {},
      null,
      'billing/send-invoice',
    );

    function childOf(
      parent: WorkflowInstance,
      childDefinition: Definition,
    ): WorkflowInstance {
      const request = parent.requestedSubWorkflows()[0];

      if (request === undefined) throw new Error('request');

      const target = published(childDefinition);
      const instance = parent.answerSubWorkflow(
        request.instanceId,
        RunnableVersion.found(target.workflow, target.version),
        roundAt(definition, now),
      );

      if (instance === null) throw new Error('sub-workflow');

      instance.beginRound(roundAt(childDefinition, now));
      return instance;
    }

    it('an_awaiting_run_task_requests_its_child_by_a_derived_id', () => {
      const parent = started(definition, { id: 42 });

      parent.beginRound(roundAt(definition, now));
      const requested = parent.requestedSubWorkflows();
      const progress = parent.progress(now);

      expect(requested).toHaveLength(1);
      expect(requested[0]?.input).toEqual({ id: 42 });
      expect(progress.kind).toBe(InstanceProgressKind.Park);
      expect(progress.subWorkflows).toEqual([requested[0]?.instanceId]);
    });

    it('a_completed_child_completes_its_run_task_with_its_output', () => {
      const parent = started(definition, { id: 42 });
      parent.beginRound(roundAt(definition, now));
      const instance = childOf(parent, child);

      parent.completeSubWorkflow(
        instance.id,
        {
          phase: instance.phase,
          output: instance.output,
          error: instance.error,
        },
        roundAt(definition, now),
      );

      expect(parent.phase).toBe(Phase.Completed);
      expect(parent.output).toEqual({ sent: true });
    });

    it('a_faulted_child_faults_its_run_task_with_its_error_at_the_task', () => {
      const parent = started(definition, { id: 42 });
      parent.beginRound(roundAt(definition, now));
      const instance = childOf(parent, failingChild);

      parent.completeSubWorkflow(
        instance.id,
        {
          phase: instance.phase,
          output: instance.output,
          error: instance.error,
        },
        roundAt(definition, now),
      );

      expect(parent.phase).toBe(Phase.Faulted);
      expect(parent.error?.title).toBe('Boom');
      expect(parent.error?.instance).toBe('/do/0/invoice');
    });

    it('a_sub_workflow_of_another_workflow_than_the_task_names_is_refused', () => {
      const parent = started(definition, { id: 42 });
      parent.beginRound(roundAt(definition, now));
      const other = definitionOf([{ send: { set: { sent: true } } }]);

      const start = () => childOf(parent, other);

      expect(start).toThrow(TypeError);
    });

    it('a_refused_child_faults_its_run_task_with_a_configuration_error', () => {
      const parent = started(definition, { id: 42 });
      parent.beginRound(roundAt(definition, now));
      const request = parent.requestedSubWorkflows()[0];

      if (request === undefined) throw new Error('request');

      const subWorkflow = parent.answerSubWorkflow(
        request.instanceId,
        RunnableVersion.found(null, null),
        roundAt(definition, now),
      );

      expect(subWorkflow).toBeNull();

      expect(parent.phase).toBe(Phase.Faulted);
      expect(parent.error?.status).toBe(400);
      expect(parent.error?.instance).toBe('/do/0/invoice');
    });
  });

  describe('detached sub-workflows', () => {
    const definition = definitionOf([
      {
        archive: {
          run: {
            workflow: {
              namespace: 'billing',
              name: 'archive',
              version: 'latest',
            },
            await: false,
          },
        },
      },
    ]);
    const target = definitionOf(
      [{ keep: { set: { kept: true } } }],
      {},
      null,
      'billing/archive',
    );

    it('a_detached_request_answered_by_its_version_completes_the_task_with_its_input', () => {
      const parent = started(definition, { id: 7 });
      parent.beginRound(roundAt(definition, now));
      parent.takeProducedEvents();
      const request = parent.requestedSubWorkflows()[0];
      const resolved = published(target);

      if (request === undefined) throw new Error('request');

      const child = parent.answerSubWorkflow(
        request.instanceId,
        RunnableVersion.found(resolved.workflow, resolved.version),
        roundAt(definition, later(1)),
      );

      const [detached] = parent.takeDomainEvents();
      expect(request.awaited).toBe(false);
      expect(child).toBeNull();
      expect(parent.phase).toBe(Phase.Completed);
      expect(parent.output).toEqual({ id: 7 });
      expect(detached).toBeInstanceOf(WorkflowDetached);
      expect(
        detached instanceof WorkflowDetached && detached.detached.versionId,
      ).toBe(resolved.version.id);
      expect(typesOf(parent)).toEqual(['task.completed', 'workflow.completed']);
    });

    it('the_end_of_a_detached_sub_workflow_never_answers_its_task_again', () => {
      const parent = started(definition, { id: 7 });
      parent.beginRound(roundAt(definition, now));
      const request = parent.requestedSubWorkflows()[0];

      if (request === undefined) throw new Error('request');

      parent.completeSubWorkflow(
        request.instanceId,
        { phase: Phase.Completed, output: { kept: true }, error: null },
        roundAt(definition, now),
      );

      expect(parent.phase).toBe(Phase.Waiting);
      expect(parent.requestedSubWorkflows()).toHaveLength(1);
    });
  });

  it('lifecycle_events_are_accepted_when_their_round_records_them', () => {
    const definition = definitionOf([{ first: { set: { a: 1 } } }]);
    const instance = started(definition);

    instance.beginRound(roundAt(definition, later(5)));

    const [workflowStarted] = instance.takeProducedEvents();
    expect(workflowStarted?.time).toEqual(now);
    expect(workflowStarted?.acceptedAt).toEqual(later(5));
  });

  it('an_engine_failure_faults_the_instance_and_cancels_its_active_tasks', () => {
    const definition = definitionOf([{ slow: call('https://slow.example/') }]);
    const instance = started(definition);
    instance.beginRound(roundAt(definition, now));
    instance.takeProducedEvents();

    instance.fault(later(1));

    expect(instance.phase).toBe(Phase.Faulted);
    expect(instance.error?.status).toBe(500);
    expect(typesOf(instance)).toEqual(['task.cancelled', 'workflow.faulted']);
  });

  it('a_terminal_instance_never_changes_again', () => {
    const definition = definitionOf([{ first: { set: { a: 1 } } }]);
    const instance = started(definition);
    instance.beginRound(roundAt(definition, now));
    instance.takeProducedEvents();

    instance.fault(later(1));
    instance.beginRound(roundAt(definition, later(2)));

    expect(instance.phase).toBe(Phase.Completed);
    expect(instance.takeProducedEvents()).toHaveLength(0);
  });

  it('replaying_the_same_results_on_the_same_state_derives_the_same_task_ids', () => {
    const definition = definitionOf([
      { a: call('https://a.example/') },
      { b: call('https://b.example/') },
    ]);
    const first = started(definition);
    const second = started(definition);

    for (const instance of [first, second]) {
      instance.beginRound(roundAt(definition, now));
      settle(instance, definition, now, { respond: (id) => ok(id) });
    }

    const firstIds = first.tasks.map((task) => task.id);
    const secondIds = second.tasks.map((task) => task.id);
    expect(firstIds).toEqual(secondIds);
    expect(first.output).toEqual(second.output);
  });

  it('a_task_cancelled_before_its_condition_passed_is_cancelled_without_an_event', () => {
    const definition = definitionOf([
      { gated: { if: '${ .go }', set: { a: 1 } } },
    ]);
    const instance = started(definition);
    instance.beginRound(roundAt(definition, now));
    instance.takeProducedEvents();

    instance.fault(later(1));

    const gated = instance.tasks.find((task) => task.name === 'gated');
    expect(gated?.phase).toBe(Phase.Cancelled);
    expect(typesOf(instance)).toEqual(['workflow.faulted']);
  });

  it('a_task_whose_parent_is_missing_is_refused_as_corrupt_state', () => {
    const definition = definitionOf([
      { a: call('https://a.example/') },
      { b: { set: { b: 2 } } },
    ]);
    const instance = started(definition);
    instance.beginRound(roundAt(definition, now));
    const leaf = instance.tasks.find((task) => task.name === 'a');

    if (leaf === undefined) throw new Error('leaf');

    const restored = new WorkflowInstance({
      id: instance.id,
      workflowId: instance.workflowId,
      versionId: instance.versionId,
      workflow: instance.workflow,
      semver: instance.semver,
      phase: instance.phase,
      input: instance.input,
      output: null,
      error: null,
      context: {},
      origin: instance.origin,
      startedAt: instance.startedAt,
      endedAt: null,
      sequence: instance.sequence,
      executions: instance.executions,
      rounds: instance.rounds,
      tasks: [leaf],
      version: 1,
    });
    // A task's scope holds the deadlines of the tasks around it, so its work is refused.
    const work = () => restored.pendingWork(roundAt(definition, now));

    expect(work).toThrow(InconsistentProgressError);
  });

  it.each([
    ['first', ['a', 'b']],
    ['second', ['b', 'a']],
  ])(
    'a_branch_export_under_its_schema_check_as_the_%s_branch_is_kept_by_its_sibling',
    (position, order) => {
      const exported = (name: string, value: number) =>
        `\${ $context + { ${name}: ${String(value)} } }`;
      const branches: Record<string, JsonObject> = {
        a: {
          a: {
            set: { a: 1 },
            export: {
              as: exported('a', 1),
              schema: { format: 'json', document: { type: 'object' } },
            },
          },
        },
        b: { b: { set: { b: 2 }, export: { as: exported('b', 2) } } },
      };
      const declared = order.map((name) => branches[name] ?? {});
      const definition = definitionOf([
        { split: { fork: { branches: declared } } },
        { read: { set: { context: '${ $context }' } } },
      ]);
      const merged = evaluatedAs((evaluation) => {
        const context = (evaluation.arguments.context ?? {}) as JsonObject;
        const named = /\{ (\w+): (\d+) \}/.exec(evaluation.program);

        if (evaluation.program === '$context') return context;

        if (named === null) return evaluation.data;

        return { ...context, [named[1] ?? '']: Number(named[2]) };
      });
      const instance = started(definition);

      instance.beginRound(roundAt(definition, now));
      settle(instance, definition, now, { evaluate: merged });

      expect(instance.output).toEqual({ context: { a: 1, b: 2 } });
    },
  );

  it('a_branch_that_reaches_its_export_later_waits_for_the_one_under_its_schema_check', () => {
    const definition = definitionOf([
      {
        split: {
          fork: {
            branches: [
              {
                b: {
                  ...call('https://pets.example/1'),
                  export: { as: '${ $context + { b: 2 } }' },
                },
              },
              {
                a: {
                  set: { a: 1 },
                  export: {
                    as: '${ $context + { a: 1 } }',
                    schema: { format: 'json', document: { type: 'object' } },
                  },
                },
              },
            ],
          },
        },
      },
      { read: { set: { context: '${ $context }' } } },
    ]);
    const merged = evaluatedAs((evaluation) => {
      const context = (evaluation.arguments.context ?? {}) as JsonObject;
      const named = /\{ (\w+): (\d+) \}/.exec(evaluation.program);

      if (evaluation.program === '$context') return context;

      if (named === null) return evaluation.data;

      return { ...context, [named[1] ?? '']: Number(named[2]) };
    });
    const instance = started(definition);

    instance.beginRound(roundAt(definition, now));
    settle(instance, definition, now, { evaluate: merged, respond: ok });

    expect(instance.output).toEqual({ context: { a: 1, b: 2 } });
  });

  it('nothing_follows_the_fault_at_the_execution_limit', () => {
    const items = Array.from({ length: 9_995 }, (item, index) => index);
    const definition = definitionOf([
      {
        loop: {
          for: { in: '${ .items }' },
          do: [{ one: { set: { x: 1 } } }],
        },
      },
      {
        split: {
          fork: {
            branches: [
              { b1: { do: [{ inner: { set: { y: 1 } } }] } },
              {
                b2: {
                  emit: {
                    event: {
                      with: {
                        source: 'https://example.com',
                        type: 'com.example.done',
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    ]);
    const collected = evaluatedAs((evaluation) => {
      if (evaluation.program === '.items') return items;

      return evaluation.data;
    });
    const instance = started(definition, {});

    instance.beginRound(roundAt(definition, now));
    settle(instance, definition, now, { evaluate: collected });
    const types = typesOf(instance);

    const emit = instance.tasks.find(
      (task) => task.reference.toString() === '/do/1/split/fork/branches/1/b2',
    );

    expect(instance.phase).toBe(Phase.Faulted);
    expect(types.at(-1)).toBe('workflow.faulted');
    expect(types).not.toContain('com.example.done');
    expect(types.at(-2)).toBe('task.cancelled');
    expect(emit?.phase).toBe(Phase.Cancelled);
    expect(instance.takeDomainEvents()).toEqual([]);
  });

  it('the_results_of_a_round_a_later_round_superseded_are_refused', () => {
    const definition = definitionOf([{ first: { set: { a: '${ .a }' } } }]);
    const instance = started(definition);
    instance.beginRound(roundAt(definition, now));
    const superseded = instance.rounds;
    instance.beginRound(roundAt(definition, later(1)));
    const context = roundAt(definition, later(1));

    const record = () => {
      instance.recordRound(superseded, [], context);
    };

    expect(record).toThrow(StaleRoundError);
  });

  it('a_round_with_the_definition_of_another_version_is_refused', () => {
    const definition = definitionOf([{ first: { set: { a: 1 } } }]);
    const other = definitionOf(
      [{ first: { set: { a: 1 } } }],
      {},
      null,
      'billing/other',
    );
    const instance = started(definition);

    const begin = () => {
      instance.beginRound(roundAt(other, now));
    };

    expect(begin).toThrow(TypeError);
  });
});
