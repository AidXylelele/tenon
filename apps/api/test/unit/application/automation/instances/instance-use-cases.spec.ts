import { InstanceProgressKind } from '../../../../../src/domain/automation/instances/enums.js';
import { Phase } from '../../../../../src/domain/automation/language/phase.js';
import { ServiceResponded } from '../../../../../src/domain/automation/language/results/service-responded.js';
import { ServiceTimedOut } from '../../../../../src/domain/automation/language/results/service-timed-out.js';
import { SubWorkflowStartKind } from '../../../../../src/application/automation/instances/enums.js';
import { WorkDeferredError } from '../../../../../src/application/errors.js';
import { ProcessDetached } from '../../../../../src/domain/automation/instances/domain-events/process-detached.js';
import { WorkflowDetached } from '../../../../../src/domain/automation/instances/domain-events/workflow-detached.js';
import { ParentOrigin } from '../../../../../src/domain/automation/instances/origins/parent-origin.js';
import { WorkflowName } from '../../../../../src/domain/automation/language/workflow-name.js';
import { WorkflowTarget } from '../../../../../src/domain/automation/language/workflow-target.js';
import { VersionReference } from '../../../../../src/domain/automation/workflows/version-reference.js';
import {
  InstanceNotFoundError,
  StaleRoundError,
  VersionNotFoundError,
  WorkflowNotFoundError,
} from '../../../../../src/domain/errors.js';
import {
  documentOf,
  instanceWorld,
  runtime,
} from '../../../../support/instance-world.js';

const orders = new WorkflowName('default', 'orders');
const configuration =
  'https://serverlessworkflow.io/spec/1.0.0/errors/configuration';
const invoices = new WorkflowName('billing', 'invoices');

const fetchOrder = {
  fetch: {
    call: 'http',
    with: { method: 'get', endpoint: 'https://orders.example/1' },
  },
};

const ok = (id: string): ServiceResponded =>
  new ServiceResponded({
    id,
    status: 200,
    headers: {},
    content: { id: 1 },
    body: '',
    request: {},
    authorization: null,
  });

describe('StartInstance', () => {
  it('a_start_creates_a_pending_instance_of_the_current_version_and_starts_its_run', async () => {
    const world = instanceWorld();
    await world.publish(
      documentOf('orders', '1.0.0', [{ a: { set: { a: 1 } } }]),
    );

    const instance = await world.start.execute({
      target: WorkflowTarget.of(orders, null),
      input: undefined,
      userId: 'user-1',
      key: null,
    });

    expect(instance.phase).toBe(Phase.Pending);
    expect(instance.semver).toBe('1.0.0');
    expect(world.runs.started).toEqual([instance.id]);
  });

  it('a_repeated_start_with_the_same_key_returns_the_first_instance', async () => {
    const world = instanceWorld();
    await world.publish(
      documentOf('orders', '1.0.0', [{ a: { set: { a: 1 } } }]),
    );
    const command = {
      target: new WorkflowTarget(orders, '1.0.0'),
      input: { id: 1 },
      userId: 'user-1',
      key: 'key-1',
    };

    const first = await world.start.execute(command);
    const second = await world.start.execute(command);

    expect(second.id).toBe(first.id);
    expect(world.runs.started).toEqual([first.id]);
  });

  it('a_start_of_an_unknown_workflow_or_version_is_refused', async () => {
    const world = instanceWorld();
    await world.publish(
      documentOf('orders', '1.0.0', [{ a: { set: { a: 1 } } }]),
    );
    const command = {
      target: new WorkflowTarget(orders, '9.9.9'),
      input: {},
      userId: 'user-1',
      key: null,
    };
    const elsewhere = new WorkflowTarget(invoices, '9.9.9');

    const unknownVersion = world.start.execute(command);
    const unknownWorkflow = world.start.execute({
      ...command,
      target: elsewhere,
    });

    await expect(unknownVersion).rejects.toThrow(VersionNotFoundError);
    await expect(unknownWorkflow).rejects.toThrow(WorkflowNotFoundError);
  });
});

describe('timeouts of work in progress', () => {
  const timeoutType = 'https://serverlessworkflow.io/spec/1.0.0/errors/timeout';

  // Answers after `seconds`, as the service gateway does: an answer past the call's
  // deadline is a time-out, and `deferred` gives no answer at all.
  function slowWorld(seconds: number, document: string, deferred = false) {
    const world = instanceWorld((call) => {
      const elapsed = world.clock.time.getTime() + seconds * 1000;
      world.clock.time = new Date(elapsed);
      const late = call.deadline !== null && call.deadline < world.clock.time;

      if (deferred) return null;

      if (late) return new ServiceTimedOut(call.id);

      return ok(call.id);
    });
    const started = world.publish(document).then(() =>
      world.start.execute({
        target: WorkflowTarget.of(orders, null),
        input: {},
        userId: 'user-1',
        key: null,
      }),
    );
    return { world, started };
  }

  const timedFetch = {
    fetch: {
      call: 'http',
      with: { method: 'get', endpoint: 'https://orders.example/1' },
      timeout: { after: { seconds: 2 } },
    },
  };

  it('a_call_carries_the_deadline_of_its_task', async () => {
    const document = documentOf('orders', '1.0.0', [timedFetch]);
    const { world, started } = slowWorld(1, document);
    const instance = await started;
    const startedAt = world.clock.time.getTime();

    await world.advance.execute({ instanceId: instance.id, runtime });

    const deadline = world.services.calls[0]?.deadline?.getTime();
    expect(deadline).toBe(startedAt + 2000);
  });

  it('a_call_that_outlasts_its_task_timeout_faults_the_task_with_a_timeout_error', async () => {
    const document = documentOf('orders', '1.0.0', [timedFetch]);
    const { world, started } = slowWorld(20, document);
    const instance = await started;

    await world.advance.execute({ instanceId: instance.id, runtime });

    const saved = await world.instances.find(instance.id);
    expect(saved?.phase).toBe(Phase.Faulted);
    expect(saved?.error?.type).toBe(timeoutType);
    expect(saved?.error?.instance).toBe('/do/0/fetch');
  });

  it('a_deadline_that_passed_while_a_call_waited_for_room_interrupts_its_task', async () => {
    const document = documentOf('orders', '1.0.0', [timedFetch]);
    const { world, started } = slowWorld(20, document, true);
    const instance = await started;

    await world.advance.execute({ instanceId: instance.id, runtime });

    const saved = await world.instances.find(instance.id);
    expect(saved?.phase).toBe(Phase.Faulted);
    expect(saved?.error?.type).toBe(timeoutType);
    expect(saved?.error?.instance).toBe('/do/0/fetch');
  });

  it('a_call_that_answers_in_time_completes_when_its_answer_arrived', async () => {
    const document = documentOf('orders', '1.0.0', [timedFetch]);
    const { world, started } = slowWorld(1, document);
    const instance = await started;
    const startedAt = world.clock.time.getTime();

    await world.advance.execute({ instanceId: instance.id, runtime });

    const saved = await world.instances.find(instance.id);
    expect(saved?.phase).toBe(Phase.Completed);
    expect(saved?.endedAt?.getTime()).toBe(startedAt + 1000);
  });

  it('the_workflow_timeout_interrupts_a_call_in_progress', async () => {
    const document = JSON.stringify({
      document: {
        dsl: '1.0.3',
        namespace: 'default',
        name: 'orders',
        version: '1.0.0',
      },
      timeout: { after: { seconds: 5 } },
      do: [fetchOrder, { done: { set: { done: true } } }],
    });
    const { world, started } = slowWorld(20, document);
    const instance = await started;

    await world.advance.execute({ instanceId: instance.id, runtime });

    const saved = await world.instances.find(instance.id);
    expect(saved?.phase).toBe(Phase.Faulted);
    expect(saved?.error?.type).toBe(timeoutType);
    expect(saved?.output).toBeNull();
  });
});

describe('answers in the order they arrive', () => {
  it('the_first_competing_branch_to_finish_wins_whatever_its_place', async () => {
    const call = (host: string) => ({
      call: 'http',
      with: { method: 'get', endpoint: `https://${host}.example/` },
    });
    const document = documentOf('orders', '1.0.0', [
      {
        race: {
          fork: {
            compete: true,
            branches: [{ slow: call('slow') }, { fast: call('fast') }],
          },
        },
      },
    ]);
    const world = instanceWorld(
      (asked) => ok(asked.id),
      () => null,
      (asked) => (JSON.stringify(asked.endpoint.uri).includes('slow') ? 50 : 5),
    );
    await world.publish(document);
    const instance = await world.start.execute({
      target: WorkflowTarget.of(orders, null),
      input: {},
      userId: 'user-1',
      key: null,
    });

    await world.advance.execute({ instanceId: instance.id, runtime });

    const saved = await world.instances.find(instance.id);
    const records = Array.from(world.instances.taskRows.values());
    const slow = records.find((record) => record.reference.endsWith('/slow'));
    const fast = records.find((record) => record.reference.endsWith('/fast'));
    expect(saved?.phase).toBe(Phase.Completed);
    expect(fast?.phase).toBe('completed');
    expect(slow?.phase).toBe('cancelled');
  });
});

describe('the task-execution limit', () => {
  it('an_instance_that_reaches_10000_task_executions_faults_at_the_task_that_spawns_more', async () => {
    const world = instanceWorld();
    await world.publish(
      documentOf('orders', '1.0.0', [
        { each: { for: { in: '${ . }' }, do: [{ one: { set: { x: 1 } } }] } },
      ]),
    );
    const items = Array.from({ length: 10_001 }, (_, index) => index);
    const instance = await world.start.execute({
      target: WorkflowTarget.of(orders, null),
      input: items,
      userId: 'user-1',
      key: null,
    });

    await world.advance.execute({ instanceId: instance.id, runtime });

    const saved = await world.instances.find(instance.id);
    expect(saved?.phase).toBe(Phase.Faulted);
    expect(saved?.error?.instance).toBe('/do/0/each');
    expect(saved?.error?.detail).toBe(
      'The instance reached its limit of 10,000 task executions',
    );
  }, 60_000);
});

describe('rounds that a later round superseded', () => {
  it('a_round_that_resumes_after_another_worker_took_the_instance_records_nothing', async () => {
    let delays = 0;
    let answers = 0;
    const world = instanceWorld(
      (call) => {
        answers += 1;

        if (answers === 1) return ok(call.id);

        return new ServiceTimedOut(call.id);
      },
      () => null,
      () => {
        delays += 1;

        if (delays === 1) return 50;

        return 0;
      },
    );
    await world.publish(documentOf('orders', '1.0.0', [fetchOrder]));
    const instance = await world.start.execute({
      target: WorkflowTarget.of(orders, null),
      input: {},
      userId: 'user-1',
      key: null,
    });

    const frozen = world.advance.execute({ instanceId: instance.id, runtime });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await world.advance.execute({ instanceId: instance.id, runtime });

    await expect(frozen).rejects.toThrow(StaleRoundError);
    const saved = await world.instances.find(instance.id);
    expect(saved?.phase).toBe(Phase.Completed);
    expect(saved?.output).toEqual({ id: 1 });
  });
});

describe('AdvanceInstance', () => {
  async function startedWorld(respond = ok) {
    const world = instanceWorld((call) => respond(call.id));
    await world.publish(
      documentOf('orders', '1.0.0', [
        fetchOrder,
        { done: { set: { done: true } } },
      ]),
    );
    const instance = await world.start.execute({
      target: WorkflowTarget.of(orders, null),
      input: {},
      userId: 'user-1',
      key: null,
    });
    return { world, instance };
  }

  it('a_round_runs_until_a_call_and_records_its_result_in_a_second_transaction', async () => {
    const { world, instance } = await startedWorld();

    const advanced = await world.advance.execute({
      instanceId: instance.id,
      runtime,
    });

    const saved = await world.instances.find(instance.id);
    expect(world.services.calls).toHaveLength(1);
    expect(advanced.progress.kind).toBe(InstanceProgressKind.Ended);
    expect(saved?.phase).toBe(Phase.Completed);
    expect(saved?.output).toEqual({ done: true });
    expect(world.events.events.length).toBeGreaterThan(0);
  });

  it('a_call_the_full_bulkhead_did_not_start_stays_pending_and_is_reported_as_deferred', async () => {
    const { world, instance } = await startedWorld(() => null as never);

    const advanced = await world.advance.execute({
      instanceId: instance.id,
      runtime,
    });

    const saved = await world.instances.find(instance.id);
    expect(advanced.deferred).toBe(1);
    expect(saved?.phase).toBe(Phase.Running);
  });

  it('an_unknown_instance_is_refused', async () => {
    const world = instanceWorld();

    const advance = world.advance.execute({ instanceId: 'missing', runtime });

    await expect(advance).rejects.toThrow(InstanceNotFoundError);
  });
});

describe('FaultInstance', () => {
  it('an_engine_failure_faults_the_instance_and_records_its_events', async () => {
    const world = instanceWorld();
    await world.publish(documentOf('orders', '1.0.0', [fetchOrder]));
    const instance = await world.start.execute({
      target: WorkflowTarget.of(orders, null),
      input: {},
      userId: 'user-1',
      key: null,
    });

    await world.fault.execute({ instanceId: instance.id });

    const saved = await world.instances.find(instance.id);
    expect(saved?.phase).toBe(Phase.Faulted);
    expect(world.events.events.map((event) => event.type)).toContain(
      'io.serverlessworkflow.workflow.faulted.v1',
    );
  });
});

describe('sub-workflows', () => {
  const parentBody = [
    {
      invoice: {
        run: {
          workflow: {
            namespace: 'billing',
            name: 'invoices',
            version: 'latest',
          },
        },
      },
    },
  ];

  async function parentWorld(publishChild: boolean) {
    const world = instanceWorld();
    await world.publish(documentOf('orders', '1.0.0', parentBody));

    if (publishChild)
      await world.publish(
        documentOf('billing/invoices', '2.0.0', [
          { send: { set: { sent: true } } },
        ]),
      );

    const parent = await world.start.execute({
      target: WorkflowTarget.of(orders, null),
      input: { id: 1 },
      userId: 'user-1',
      key: null,
    });
    const advanced = await world.advance.execute({
      instanceId: parent.id,
      runtime,
    });
    const [subWorkflowId = ''] = advanced.progress.subWorkflows;
    return { world, parent, subWorkflowId };
  }

  it('a_requested_sub_workflow_is_started_once_on_the_current_version', async () => {
    const { world, parent, subWorkflowId } = await parentWorld(true);
    const command = { instanceId: parent.id, subWorkflowId, runtime };

    const started = await world.startSubWorkflow.execute(command);
    const again = await world.startSubWorkflow.execute(command);

    const subWorkflow = await world.instances.find(subWorkflowId);
    expect(started.kind).toBe(SubWorkflowStartKind.Started);
    expect(again.kind).toBe(SubWorkflowStartKind.Started);
    expect(subWorkflow?.semver).toBe('2.0.0');
  });

  it('a_missing_target_faults_the_run_task_and_starts_nothing', async () => {
    const { world, parent, subWorkflowId } = await parentWorld(false);

    const started = await world.startSubWorkflow.execute({
      instanceId: parent.id,
      subWorkflowId,
      runtime,
    });

    const saved = await world.instances.find(parent.id);
    const again = await world.startSubWorkflow.execute({
      instanceId: parent.id,
      subWorkflowId,
      runtime,
    });
    expect(started.kind).toBe(SubWorkflowStartKind.Answered);
    expect(saved?.phase).toBe(Phase.Faulted);
    expect(saved?.error?.type).toBe(configuration);
    expect(again.kind).toBe(SubWorkflowStartKind.Answered);
  });

  it('a_completed_sub_workflow_completes_its_parent_task', async () => {
    const { world, parent, subWorkflowId } = await parentWorld(true);
    const command = { instanceId: parent.id, subWorkflowId, runtime };
    await world.startSubWorkflow.execute(command);
    await world.advance.execute({ instanceId: subWorkflowId, runtime });

    await world.completeSubWorkflow.execute(command);

    const saved = await world.instances.find(parent.id);
    expect(saved?.phase).toBe(Phase.Completed);
    expect(saved?.output).toEqual({ sent: true });
  });

  it('a_sub_workflow_that_ended_without_a_result_faults_the_run_task', async () => {
    const { world, parent, subWorkflowId } = await parentWorld(true);

    await world.completeSubWorkflow.execute({
      instanceId: parent.id,
      subWorkflowId,
      runtime,
    });

    const saved = await world.instances.find(parent.id);
    expect(saved?.phase).toBe(Phase.Faulted);
    expect(saved?.error?.type).toBe(
      'https://serverlessworkflow.io/spec/1.0.0/errors/runtime',
    );
    expect(saved?.error?.instance).toBe('/do/0/invoice');
  });
});

describe('detached work', () => {
  const detachedBody = (version: string) => [
    {
      archive: {
        run: {
          workflow: { namespace: 'billing', name: 'invoices', version },
          await: false,
        },
      },
    },
  ];

  async function detachingWorld(version: string, publishChild: boolean) {
    const world = instanceWorld();
    await world.publish(documentOf('orders', '1.0.0', detachedBody(version)));

    if (publishChild)
      await world.publish(
        documentOf('billing/invoices', '2.0.0', [
          { keep: { set: { kept: true } } },
        ]),
      );

    const parent = await world.start.execute({
      target: WorkflowTarget.of(orders, null),
      input: { id: 1 },
      userId: 'user-1',
      key: null,
    });
    const advanced = await world.advance.execute({
      instanceId: parent.id,
      runtime,
    });
    const [subWorkflowId = ''] = advanced.progress.subWorkflows;
    return { world, parent, subWorkflowId };
  }

  it('a_detached_sub_workflow_is_resolved_by_its_start_step_and_completes_its_task', async () => {
    const { world, parent, subWorkflowId } = await detachingWorld(
      'latest',
      true,
    );

    const answered = await world.startSubWorkflow.execute({
      instanceId: parent.id,
      subWorkflowId,
      runtime,
    });
    await world.advance.execute({ instanceId: parent.id, runtime });

    const saved = await world.instances.find(parent.id);
    const pinned = await world.versions.find(invoices, '2.0.0');
    const [detached] = world.instances.domainEvents;
    expect(answered.kind).toBe(SubWorkflowStartKind.Answered);
    expect(saved?.phase).toBe(Phase.Completed);
    expect(saved?.output).toEqual({ id: 1 });
    expect(detached).toBeInstanceOf(WorkflowDetached);
    expect(
      detached instanceof WorkflowDetached && detached.detached.versionId,
    ).toBe(pinned?.id);
  });

  it('a_detached_sub_workflow_whose_target_is_missing_faults_its_task', async () => {
    const { world, parent, subWorkflowId } = await detachingWorld(
      '1.0.0',
      false,
    );

    await world.startSubWorkflow.execute({
      instanceId: parent.id,
      subWorkflowId,
      runtime,
    });

    const saved = await world.instances.find(parent.id);
    expect(saved?.phase).toBe(Phase.Faulted);
    expect(saved?.error?.type).toBe(configuration);
    expect(world.instances.domainEvents).toHaveLength(0);
  });

  it('a_detached_sub_workflow_starts_once_from_its_event_with_a_parent_origin', async () => {
    const { world, parent, subWorkflowId } = await detachingWorld(
      'latest',
      true,
    );
    await world.startSubWorkflow.execute({
      instanceId: parent.id,
      subWorkflowId,
      runtime,
    });
    const [detached] = world.instances.domainEvents;

    if (!(detached instanceof WorkflowDetached)) throw new Error('detached');

    const command = {
      parentId: detached.instanceId,
      taskInstanceId: detached.taskInstanceId,
      subWorkflowId: detached.subWorkflowId,
      workflow: detached.detached.workflow,
      version: VersionReference.byId(detached.detached.versionId),
      input: detached.detached.input,
    };
    await world.startDetached.execute(command);
    await world.startDetached.execute(command);
    const replayed = await world.startSubWorkflow.execute({
      instanceId: parent.id,
      subWorkflowId,
      runtime,
    });

    const child = await world.instances.find(subWorkflowId);
    expect(child?.semver).toBe('2.0.0');
    expect(child?.origin).toBeInstanceOf(ParentOrigin);
    expect(world.runs.started).toEqual([parent.id, subWorkflowId]);
    expect(replayed.kind).toBe(SubWorkflowStartKind.Answered);
  });

  it('a_detached_process_the_full_bulkhead_rejected_is_deferred', async () => {
    const world = instanceWorld();
    await world.publish(
      documentOf('orders', '1.0.0', [
        { ping: { run: { shell: { command: 'echo hi' }, await: false } } },
      ]),
    );
    const parent = await world.start.execute({
      target: WorkflowTarget.of(orders, null),
      input: {},
      userId: 'user-1',
      key: null,
    });
    await world.advance.execute({ instanceId: parent.id, runtime });
    const [detached] = world.instances.domainEvents;

    if (!(detached instanceof ProcessDetached)) throw new Error('process');

    const run = world.runDetached.execute({ run: detached.run });

    await expect(run).rejects.toThrow(WorkDeferredError);
  });
});
