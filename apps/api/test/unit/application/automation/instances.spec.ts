import { Missing } from '../../../../src/application/automation/enums.js';
import { BeginInstance } from '../../../../src/application/automation/instances/begin-instance.js';
import { BeginWaiting } from '../../../../src/application/automation/instances/begin-waiting.js';
import { CancelInstance } from '../../../../src/application/automation/instances/cancel-instance.js';
import { CompleteInstance } from '../../../../src/application/automation/instances/complete-instance.js';
import { DeleteInstance } from '../../../../src/application/automation/instances/delete-instance.js';
import { EndWaiting } from '../../../../src/application/automation/instances/end-waiting.js';
import { TaskStatus } from '../../../../src/application/automation/instances/enums.js';
import { FaultInstance } from '../../../../src/application/automation/instances/fault-instance.js';
import { InstanceDirective } from '../../../../src/application/automation/instances/instance-directive.js';
import { RecordTaskEnd } from '../../../../src/application/automation/instances/record-task-end.js';
import { RecordTaskStart } from '../../../../src/application/automation/instances/record-task-start.js';
import { RestartInstance } from '../../../../src/application/automation/instances/restart-instance.js';
import { ResumeInstance } from '../../../../src/application/automation/instances/resume-instance.js';
import { StartInstance } from '../../../../src/application/automation/instances/start-instance.js';
import { SuspendInstance } from '../../../../src/application/automation/instances/suspend-instance.js';
import {
  InstanceEventKind,
  InstanceRefusal,
  Phase,
  RunDirective,
  TriggerKind,
} from '../../../../src/domain/automation/instances/enums.js';
import type { WorkflowInstance } from '../../../../src/domain/automation/instances/workflow-instance.js';
import { WorkflowRefusal } from '../../../../src/domain/automation/workflows/enums.js';
import { Workflow } from '../../../../src/domain/automation/workflows/workflow.js';
import { WorkflowName } from '../../../../src/domain/automation/workflows/workflow-name.js';
import type { WorkflowVersion } from '../../../../src/domain/automation/workflows/workflow-version.js';
import { aDefinition } from '../../../support/builders.js';
import {
  FixedClock,
  RecordingInstanceRuns,
  RecordingSchedules,
  RecordingTaskProgress,
  StoredWorkflowInstanceRepository,
  StoredWorkflowRepository,
  StoredWorkflowVersionRepository,
  T0,
  aTask,
  anInstanceIn,
} from '../../../support/qa-fakes.js';

const now = new Date('2026-11-03T12:00:00.000Z');
const name = new WorkflowName('sales', 'route-lead');
const ENDED = [Phase.Cancelled, Phase.Faulted, Phase.Completed];
const OPEN = [Phase.Pending, Phase.Running, Phase.Waiting, Phase.Suspended];
const NOT_SUSPENDABLE = [
  Phase.Pending,
  Phase.Suspended,
  Phase.Cancelled,
  Phase.Faulted,
  Phase.Completed,
];
const NOT_SUSPENDED = [
  Phase.Pending,
  Phase.Running,
  Phase.Waiting,
  Phase.Cancelled,
  Phase.Faulted,
  Phase.Completed,
];

function setUp(...seed: WorkflowInstance[]) {
  const clock = new FixedClock(now);
  const instances = new StoredWorkflowInstanceRepository(...seed);
  const workflows = new StoredWorkflowRepository();
  const versions = new StoredWorkflowVersionRepository(workflows);
  const runs = new RecordingInstanceRuns(instances);
  const progress = new RecordingTaskProgress(instances);
  const schedules = new RecordingSchedules();
  return {
    clock,
    instances,
    workflows,
    versions,
    runs,
    progress,
    schedules,
    start: new StartInstance(workflows, versions, instances, runs, clock),
    restart: new RestartInstance(workflows, versions, instances, runs, clock),
    cancel: new CancelInstance(instances, progress, clock),
    suspend: new SuspendInstance(instances),
    resume: new ResumeInstance(instances),
    remove: new DeleteInstance(instances),
    begin: new BeginInstance(instances, clock),
    taskStart: new RecordTaskStart(instances, progress),
    taskEnd: new RecordTaskEnd(instances, progress),
    waiting: new BeginWaiting(instances),
    running: new EndWaiting(instances),
    directive: new InstanceDirective(instances),
    complete: new CompleteInstance(
      instances,
      progress,
      versions,
      schedules,
      clock,
    ),
    fault: new FaultInstance(instances, progress, clock),
  };
}

type Fixture = ReturnType<typeof setUp>;

// Publishes the versions in order (the last becomes current) and stores the workflow.
async function published(
  fixture: Fixture,
  ...semvers: string[]
): Promise<{ workflow: Workflow; versions: WorkflowVersion[] }> {
  const found = await fixture.workflows.findByName(name);
  const workflow = found ?? Workflow.register(name);
  const versions: WorkflowVersion[] = [];

  for (const semver of semvers) {
    const definition = aDefinition({ version: semver }, `content-${semver}`);
    const result = workflow.publish({
      definition,
      existing: null,
      publisherId: 'author-1',
      now: T0,
    });

    if (!result.ok) throw new Error(result.failure);

    versions.push(result.value.version);
    await fixture.versions.add(result.value.version);
  }

  await fixture.workflows.save(workflow);
  return { workflow, versions };
}

async function archived(fixture: Fixture): Promise<void> {
  const workflow = await fixture.workflows.findByName(name);
  workflow!.archive(T0);
  await fixture.workflows.save(workflow!);
}

const ofInstance = { instanceId: 'instance-1' };
const ofUnknown = { instanceId: 'gone' };

describe('starting an instance', () => {
  it('a_start_without_a_version_runs_the_current_one_and_starts_its_run_once', async () => {
    const fixture = setUp();
    const { versions } = await published(fixture, '1.0.0', '2.0.0');

    const result = await fixture.start.execute({
      name,
      version: null,
      input: { amount: 5 },
      starterId: 'author-1',
    });

    const instance = result.ok ? result.value : null;
    expect(instance?.versionId).toBe(versions[1]?.id);
    expect(instance?.phase).toBe(Phase.Pending);
    expect(instance?.trigger).toBe(TriggerKind.Manual);
    expect(instance?.starterId).toBe('author-1');
    expect(instance?.originId).toBeNull();
    expect(instance?.input).toEqual({ amount: 5 });
    expect(instance?.createdAt).toBe(now);
    expect(fixture.instances.phaseOf(instance!.id)).toBe(Phase.Pending);
    expect(fixture.runs.started).toHaveLength(1);
    expect(fixture.runs.started[0]?.instance).toBe(instance);
    expect(fixture.runs.started[0]?.stored).toBe(true);
  });

  it('a_start_that_names_a_version_runs_that_version', async () => {
    const fixture = setUp();
    const { versions } = await published(fixture, '1.0.0', '2.0.0');

    const result = await fixture.start.execute({
      name,
      version: '1.0.0',
      input: null,
      starterId: 'author-1',
    });

    expect(result.ok && result.value.versionId).toBe(versions[0]?.id);
    expect(fixture.runs.started).toHaveLength(1);
  });

  it('a_start_follows_the_current_version_as_it_moves', async () => {
    const fixture = setUp();
    const first = await published(fixture, '1.0.0');
    const command = { name, version: null, input: null, starterId: 'a' };
    const before = await fixture.start.execute(command);
    const second = await published(fixture, '2.0.0');

    const after = await fixture.start.execute(command);

    expect(before.ok && before.value.versionId).toBe(first.versions[0]?.id);
    expect(after.ok && after.value.versionId).toBe(second.versions[0]?.id);
  });

  it('two_starts_are_two_instances_with_two_runs', async () => {
    const fixture = setUp();
    await published(fixture, '1.0.0');
    const command = { name, version: null, input: null, starterId: 'a' };

    const first = await fixture.start.execute(command);
    const second = await fixture.start.execute(command);

    const firstId = first.ok ? first.value.id : null;
    const secondId = second.ok ? second.value.id : null;
    expect(firstId).not.toBe(secondId);
    expect(fixture.instances.rows.size).toBe(2);
    expect(fixture.runs.started).toHaveLength(2);
  });

  it('an_unknown_workflow_is_not_found_and_nothing_starts', async () => {
    const fixture = setUp();

    const result = await fixture.start.execute({
      name,
      version: null,
      input: null,
      starterId: 'author-1',
    });

    expect(result).toEqual({ ok: false, failure: Missing.Workflow });
    expect(fixture.instances.saves).toBe(0);
    expect(fixture.runs.started).toEqual([]);
  });

  it('an_unpublished_version_is_not_found_and_nothing_starts', async () => {
    const fixture = setUp();
    await published(fixture, '1.0.0');

    const result = await fixture.start.execute({
      name,
      version: '9.9.9',
      input: null,
      starterId: 'author-1',
    });

    expect(result).toEqual({ ok: false, failure: Missing.Version });
    expect(fixture.instances.saves).toBe(0);
    expect(fixture.runs.started).toEqual([]);
  });

  it('a_workflow_without_a_current_version_starts_nothing', async () => {
    const fixture = setUp();
    await published(fixture);

    const result = await fixture.start.execute({
      name,
      version: null,
      input: null,
      starterId: 'author-1',
    });

    expect(result).toEqual({ ok: false, failure: Missing.Version });
    expect(fixture.runs.started).toEqual([]);
  });

  it.each([null, '1.0.0'])(
    'an_archived_workflow_starts_nothing_for_version_%s',
    async (version) => {
      const fixture = setUp();
      await published(fixture, '1.0.0');
      await archived(fixture);

      const result = await fixture.start.execute({
        name,
        version,
        input: null,
        starterId: 'author-1',
      });

      expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
      expect(fixture.instances.saves).toBe(0);
      expect(fixture.runs.started).toEqual([]);
    },
  );

  it('a_run_that_fails_to_start_fails_the_start', async () => {
    const fixture = setUp();
    await published(fixture, '1.0.0');
    fixture.runs.start = () => Promise.reject(new Error('engine down'));

    const started = fixture.start.execute({
      name,
      version: null,
      input: null,
      starterId: 'author-1',
    });

    await expect(started).rejects.toThrow('engine down');
  });
});

describe('restarting an instance', () => {
  async function storedIn(
    fixture: Fixture,
    phase: Phase,
  ): Promise<WorkflowInstance> {
    const workflow = await fixture.workflows.findByName(name);
    const version = await fixture.versions.find(name, '1.0.0');
    const previous = anInstanceIn(phase, {
      workflowId: workflow!.id,
      versionId: version!.id,
      input: { amount: 42 },
    });
    fixture.instances.put(previous);
    return previous;
  }

  it.each(ENDED)(
    'a_%s_instance_restarts_as_a_new_instance_whose_run_starts_once',
    async (phase) => {
      const fixture = setUp();
      await published(fixture, '1.0.0');
      const previous = await storedIn(fixture, phase);

      const result = await fixture.restart.execute({
        instanceId: previous.id,
        starterId: 'author-2',
      });

      const restarted = result.ok ? result.value : null;
      expect(restarted?.trigger).toBe(TriggerKind.Restart);
      expect(restarted?.originId).toBe(previous.id);
      expect(restarted?.versionId).toBe(previous.versionId);
      expect(restarted?.input).toEqual({ amount: 42 });
      expect(restarted?.starterId).toBe('author-2');
      expect(restarted?.createdAt).toBe(now);
      expect(fixture.instances.phaseOf(restarted!.id)).toBe(Phase.Pending);
      expect(fixture.instances.phaseOf(previous.id)).toBe(phase);
      expect(fixture.instances.rows.get(previous.id)?.version).toBe(1);
      expect(fixture.runs.started).toHaveLength(1);
      expect(fixture.runs.started[0]?.instance).toBe(restarted);
      expect(fixture.runs.started[0]?.stored).toBe(true);
    },
  );

  it.each(OPEN)('a_%s_instance_is_not_restarted', async (phase) => {
    const fixture = setUp();
    await published(fixture, '1.0.0');
    const previous = await storedIn(fixture, phase);

    const result = await fixture.restart.execute({
      instanceId: previous.id,
      starterId: 'author-2',
    });

    expect(result).toEqual({ ok: false, failure: InstanceRefusal.NotEnded });
    expect(fixture.instances.saves).toBe(0);
    expect(fixture.runs.started).toEqual([]);
  });

  it('a_restart_keeps_the_previous_version_after_the_current_one_moved', async () => {
    const fixture = setUp();
    const first = await published(fixture, '1.0.0');
    const previous = await storedIn(fixture, Phase.Completed);
    await published(fixture, '2.0.0');

    const result = await fixture.restart.execute({
      instanceId: previous.id,
      starterId: 'author-2',
    });

    expect(result.ok && result.value.versionId).toBe(first.versions[0]?.id);
  });

  it('an_ended_instance_of_an_archived_workflow_is_not_restarted', async () => {
    const fixture = setUp();
    await published(fixture, '1.0.0');
    const previous = await storedIn(fixture, Phase.Faulted);
    await archived(fixture);

    const result = await fixture.restart.execute({
      instanceId: previous.id,
      starterId: 'author-2',
    });

    expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
    expect(fixture.instances.saves).toBe(0);
    expect(fixture.runs.started).toEqual([]);
  });

  it('an_unknown_instance_is_not_found', async () => {
    const fixture = setUp();

    const result = await fixture.restart.execute({
      instanceId: 'gone',
      starterId: 'author-2',
    });

    expect(result).toEqual({ ok: false, failure: Missing.Instance });
    expect(fixture.runs.started).toEqual([]);
  });

  it('an_instance_whose_version_is_gone_answers_the_version_missing', async () => {
    const fixture = setUp();
    await published(fixture, '1.0.0');
    const previous = await storedIn(fixture, Phase.Completed);
    fixture.versions.versions.clear();

    const result = await fixture.restart.execute({
      instanceId: previous.id,
      starterId: 'author-2',
    });

    expect(result).toEqual({ ok: false, failure: Missing.Version });
    expect(fixture.runs.started).toEqual([]);
  });

  // DEFECT (low): restart-instance.ts:41 answers Missing.Version when the workflow itself is
  // missing; StartInstance answers Missing.Workflow for the same situation.
  it('an_instance_whose_workflow_is_gone_answers_the_workflow_missing', async () => {
    const fixture = setUp();
    await published(fixture, '1.0.0');
    const previous = await storedIn(fixture, Phase.Completed);
    fixture.workflows.rows.clear();

    const result = await fixture.restart.execute({
      instanceId: previous.id,
      starterId: 'author-2',
    });

    expect(result).toEqual({ ok: false, failure: Missing.Workflow });
  });
});

describe('cancelling an instance', () => {
  it.each(OPEN)(
    'a_%s_instance_ends_cancelled_and_the_engine_is_told_once',
    async (phase) => {
      const fixture = setUp(anInstanceIn(phase));

      const result = await fixture.cancel.execute(ofInstance);

      expect(result).toEqual({ ok: true, value: undefined });
      expect(fixture.instances.phaseOf('instance-1')).toBe(Phase.Cancelled);
      expect(fixture.instances.rows.get('instance-1')?.endedAt).toBe(now);
      expect(fixture.instances.outbox).toEqual([
        { kind: InstanceEventKind.Cancelled, instanceId: 'instance-1' },
      ]);
    },
  );

  it.each(ENDED)(
    'a_%s_instance_refuses_and_nothing_is_written',
    async (phase) => {
      const fixture = setUp(anInstanceIn(phase));

      const result = await fixture.cancel.execute(ofInstance);

      expect(result).toEqual({ ok: false, failure: InstanceRefusal.Ended });
      expect(fixture.instances.saves).toBe(0);
      expect(fixture.instances.phaseOf('instance-1')).toBe(phase);
      expect(fixture.instances.outbox).toEqual([]);
    },
  );

  it('a_second_cancel_is_refused_and_told_nothing_more', async () => {
    const fixture = setUp(anInstanceIn(Phase.Running));
    await fixture.cancel.execute(ofInstance);

    const again = await fixture.cancel.execute(ofInstance);

    expect(again).toEqual({ ok: false, failure: InstanceRefusal.Ended });
    expect(fixture.instances.outbox).toHaveLength(1);
  });

  it('an_unknown_instance_is_not_found', async () => {
    const fixture = setUp();

    const result = await fixture.cancel.execute(ofUnknown);

    expect(result).toEqual({ ok: false, failure: Missing.Instance });
  });

  it('the_children_it_awaits_end_with_it_and_each_tells_its_run', async () => {
    const parent = anInstanceIn(Phase.Running);
    const child = anInstanceIn(Phase.Waiting, {
      id: 'child-1',
      trigger: TriggerKind.Parent,
      originId: 'instance-1',
    });
    const fixture = setUp(parent, child);

    await fixture.cancel.execute(ofInstance);

    expect(fixture.instances.phaseOf('child-1')).toBe(Phase.Cancelled);
    expect(fixture.instances.outbox).toEqual([
      { kind: InstanceEventKind.Cancelled, instanceId: 'instance-1' },
      { kind: InstanceEventKind.Cancelled, instanceId: 'child-1' },
    ]);
  });

  it('ended_and_unawaited_instances_of_its_origin_stay_as_they_were', async () => {
    const parent = anInstanceIn(Phase.Running);
    const ended = anInstanceIn(Phase.Completed, {
      id: 'child-ended',
      trigger: TriggerKind.Parent,
      originId: 'instance-1',
    });
    const detached = anInstanceIn(Phase.Running, {
      id: 'child-detached',
      trigger: TriggerKind.Detached,
      originId: 'instance-1',
    });
    const fixture = setUp(parent, ended, detached);

    await fixture.cancel.execute(ofInstance);

    expect(fixture.instances.phaseOf('child-ended')).toBe(Phase.Completed);
    expect(fixture.instances.phaseOf('child-detached')).toBe(Phase.Running);
    expect(fixture.instances.outbox).toHaveLength(1);
  });

  // US9 AS3: the sub-workflows a cancelled child started are cancelled too.
  it('the_grandchildren_it_awaits_through_a_child_end_too', async () => {
    const parent = anInstanceIn(Phase.Running);
    const child = anInstanceIn(Phase.Running, {
      id: 'child-1',
      trigger: TriggerKind.Parent,
      originId: 'instance-1',
    });
    const grandchild = anInstanceIn(Phase.Running, {
      id: 'grandchild-1',
      trigger: TriggerKind.Parent,
      originId: 'child-1',
    });
    const fixture = setUp(parent, child, grandchild);

    await fixture.cancel.execute(ofInstance);

    expect(fixture.instances.phaseOf('grandchild-1')).toBe(Phase.Cancelled);
  });

  it('the_tasks_still_running_in_it_and_its_children_end_cancelled', async () => {
    const parent = anInstanceIn(Phase.Waiting);
    const child = anInstanceIn(Phase.Running, {
      id: 'child-1',
      trigger: TriggerKind.Parent,
      originId: 'instance-1',
    });
    const fixture = setUp(parent, child);

    await fixture.cancel.execute(ofInstance);

    expect(fixture.progress.cancellations).toEqual([
      { instanceId: 'instance-1', at: now },
      { instanceId: 'child-1', at: now },
    ]);
  });

  it('a_refused_cancel_ends_no_task', async () => {
    const fixture = setUp(anInstanceIn(Phase.Completed));

    await fixture.cancel.execute(ofInstance);

    expect(fixture.progress.cancellations).toEqual([]);
  });
});

describe('suspending and resuming an instance', () => {
  it.each([Phase.Running, Phase.Waiting])(
    'a_%s_instance_is_suspended_told_once_and_held_by_the_directive',
    async (phase) => {
      const fixture = setUp(anInstanceIn(phase));

      const result = await fixture.suspend.execute(ofInstance);
      const directive = await fixture.directive.execute(ofInstance);

      expect(result).toEqual({ ok: true, value: undefined });
      expect(fixture.instances.phaseOf('instance-1')).toBe(Phase.Suspended);
      expect(fixture.instances.outbox).toEqual([
        { kind: InstanceEventKind.Suspended, instanceId: 'instance-1' },
      ]);
      expect(directive).toBe(RunDirective.Suspend);
    },
  );

  it.each(NOT_SUSPENDABLE)(
    'a_%s_instance_refuses_a_suspend_and_nothing_is_written',
    async (phase) => {
      const fixture = setUp(anInstanceIn(phase));

      const result = await fixture.suspend.execute(ofInstance);

      expect(result).toEqual({
        ok: false,
        failure: InstanceRefusal.NotRunning,
      });
      expect(fixture.instances.saves).toBe(0);
      expect(fixture.instances.phaseOf('instance-1')).toBe(phase);
    },
  );

  it('an_unknown_instance_is_not_suspended', async () => {
    const fixture = setUp();

    const result = await fixture.suspend.execute(ofUnknown);

    expect(result).toEqual({ ok: false, failure: Missing.Instance });
  });

  it('a_suspended_instance_resumes_and_the_engine_is_told_once', async () => {
    const fixture = setUp(anInstanceIn(Phase.Suspended));

    const result = await fixture.resume.execute(ofInstance);
    const again = await fixture.resume.execute(ofInstance);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(again).toEqual({ ok: false, failure: InstanceRefusal.NotSuspended });
    expect(fixture.instances.phaseOf('instance-1')).toBe(Phase.Running);
    expect(fixture.instances.outbox).toEqual([
      { kind: InstanceEventKind.Resumed, instanceId: 'instance-1' },
    ]);
  });

  it.each(NOT_SUSPENDED)(
    'a_%s_instance_refuses_a_resume_and_nothing_is_written',
    async (phase) => {
      const fixture = setUp(anInstanceIn(phase));

      const result = await fixture.resume.execute(ofInstance);

      expect(result).toEqual({
        ok: false,
        failure: InstanceRefusal.NotSuspended,
      });
      expect(fixture.instances.saves).toBe(0);
      expect(fixture.instances.outbox).toEqual([]);
    },
  );

  it('an_unknown_instance_is_not_resumed', async () => {
    const fixture = setUp();

    const result = await fixture.resume.execute(ofUnknown);

    expect(result).toEqual({ ok: false, failure: Missing.Instance });
  });

  it('suspend_resume_and_cancel_are_told_in_order', async () => {
    const fixture = setUp(anInstanceIn(Phase.Running));

    await fixture.suspend.execute(ofInstance);
    await fixture.resume.execute(ofInstance);
    await fixture.suspend.execute(ofInstance);
    await fixture.cancel.execute(ofInstance);

    const kinds = fixture.instances.outbox.map((event) => event.kind);
    expect(kinds).toEqual([
      InstanceEventKind.Suspended,
      InstanceEventKind.Resumed,
      InstanceEventKind.Suspended,
      InstanceEventKind.Cancelled,
    ]);
  });
});

describe('deleting an instance', () => {
  it.each(ENDED)(
    'a_%s_instance_is_removed_and_the_engine_is_told_once',
    async (phase) => {
      const fixture = setUp(anInstanceIn(phase));

      const result = await fixture.remove.execute(ofInstance);
      const again = await fixture.remove.execute(ofInstance);

      expect(result).toEqual({ ok: true, value: undefined });
      expect(again).toEqual({ ok: false, failure: Missing.Instance });
      expect(await fixture.instances.find('instance-1')).toBeNull();
      expect(fixture.instances.outbox).toEqual([
        { kind: InstanceEventKind.Deleted, instanceId: 'instance-1' },
      ]);
    },
  );

  it.each(OPEN)('a_%s_instance_is_kept', async (phase) => {
    const fixture = setUp(anInstanceIn(phase));

    const result = await fixture.remove.execute(ofInstance);

    expect(result).toEqual({ ok: false, failure: InstanceRefusal.NotEnded });
    expect(fixture.instances.removed).toEqual([]);
    expect(fixture.instances.phaseOf('instance-1')).toBe(phase);
    expect(fixture.instances.outbox).toEqual([]);
  });

  it('an_unknown_instance_is_not_found', async () => {
    const fixture = setUp();

    const result = await fixture.remove.execute(ofUnknown);

    expect(result).toEqual({ ok: false, failure: Missing.Instance });
  });
});

describe('the runtime reporting a run', () => {
  it('beginning_a_pending_instance_runs_it_from_now', async () => {
    const fixture = setUp(anInstanceIn(Phase.Pending));

    const directive = await fixture.begin.execute(ofInstance);

    expect(directive).toBe(RunDirective.Continue);
    expect(fixture.instances.phaseOf('instance-1')).toBe(Phase.Running);
    expect(fixture.instances.rows.get('instance-1')?.startedAt).toBe(now);
    expect(fixture.instances.outbox).toEqual([
      { kind: InstanceEventKind.Started, instanceId: 'instance-1' },
    ]);
  });

  it('beginning_twice_keeps_the_first_start_and_tells_it_once', async () => {
    const fixture = setUp(anInstanceIn(Phase.Pending));
    await fixture.begin.execute(ofInstance);
    fixture.clock.current = new Date('2026-11-03T13:00:00.000Z');

    const directive = await fixture.begin.execute(ofInstance);

    expect(directive).toBe(RunDirective.Continue);
    expect(fixture.instances.rows.get('instance-1')?.startedAt).toBe(now);
    expect(fixture.instances.outbox).toHaveLength(1);
  });

  it.each([
    [Phase.Running, RunDirective.Continue],
    [Phase.Waiting, RunDirective.Continue],
    [Phase.Suspended, RunDirective.Suspend],
    [Phase.Cancelled, RunDirective.Stop],
    [Phase.Faulted, RunDirective.Stop],
    [Phase.Completed, RunDirective.Stop],
  ])(
    'beginning_a_%s_instance_leaves_it_and_answers_%s',
    async (phase, expected) => {
      const fixture = setUp(anInstanceIn(phase));

      const directive = await fixture.begin.execute(ofInstance);

      expect(directive).toBe(expected);
      expect(fixture.instances.phaseOf('instance-1')).toBe(phase);
      expect(fixture.instances.outbox).toEqual([]);
    },
  );

  it('a_task_start_is_recorded_for_the_instance', async () => {
    const fixture = setUp(anInstanceIn(Phase.Running));
    const task = aTask();

    await fixture.taskStart.execute({ instanceId: 'instance-1', task });

    expect(fixture.progress.starts).toEqual([
      { instanceId: 'instance-1', task },
    ]);
  });

  // DEFECT: record-task-start.ts never looks the instance up, so a task that starts after the
  // instance was deleted writes a progress row whose instance is gone (task_progress.instance_id
  // references workflow_instance): a foreign-key error instead of a quiet no-op.
  it('a_task_start_of_a_deleted_instance_records_nothing', async () => {
    const fixture = setUp();

    await fixture.taskStart.execute({ instanceId: 'gone', task: aTask() });

    expect(fixture.progress.starts).toEqual([]);
  });

  it.each([
    [Phase.Running, RunDirective.Continue],
    [Phase.Waiting, RunDirective.Continue],
    [Phase.Suspended, RunDirective.Suspend],
  ])(
    'a_task_end_of_a_%s_instance_is_recorded_and_answers_%s',
    async (phase, expected) => {
      const fixture = setUp(anInstanceIn(phase));
      const task = aTask(TaskStatus.Completed);

      const directive = await fixture.taskEnd.execute({
        instanceId: 'instance-1',
        task,
      });

      expect(directive).toBe(expected);
      expect(fixture.progress.ends).toEqual([
        { instanceId: 'instance-1', task },
      ]);
      expect(fixture.instances.saves).toBe(0);
    },
  );

  it.each([Phase.Faulted, Phase.Completed])(
    'a_task_end_of_a_%s_instance_is_discarded_and_answers_stop',
    async (phase) => {
      const fixture = setUp(anInstanceIn(phase));
      const task = aTask(TaskStatus.Completed);

      const directive = await fixture.taskEnd.execute({
        instanceId: 'instance-1',
        task,
      });

      expect(directive).toBe(RunDirective.Stop);
      expect(fixture.progress.ends).toEqual([]);
    },
  );

  it('a_task_end_after_a_suspend_holds_the_run', async () => {
    const fixture = setUp(anInstanceIn(Phase.Running));
    await fixture.suspend.execute(ofInstance);

    const directive = await fixture.taskEnd.execute({
      instanceId: 'instance-1',
      task: aTask(TaskStatus.Completed),
    });

    expect(directive).toBe(RunDirective.Suspend);
  });

  it('a_task_end_after_a_cancel_stops_the_run', async () => {
    const fixture = setUp(anInstanceIn(Phase.Running));
    await fixture.cancel.execute(ofInstance);

    const directive = await fixture.taskEnd.execute({
      instanceId: 'instance-1',
      task: aTask(TaskStatus.Completed),
    });

    expect(directive).toBe(RunDirective.Stop);
  });

  // DEFECT: US9 AS3 says the results of tasks in progress are discarded on a cancel, but
  // record-task-end.ts:25 records a task that ends after the cancel (e.g. as completed).
  it('a_task_end_after_a_cancel_discards_its_result', async () => {
    const fixture = setUp(anInstanceIn(Phase.Cancelled));

    await fixture.taskEnd.execute({
      instanceId: 'instance-1',
      task: aTask(TaskStatus.Completed),
    });

    expect(fixture.progress.ends).toEqual([]);
  });

  it('a_task_end_of_a_deleted_instance_stops_the_run_and_records_nothing', async () => {
    const fixture = setUp();

    const directive = await fixture.taskEnd.execute({
      instanceId: 'gone',
      task: aTask(TaskStatus.Completed),
    });

    expect(directive).toBe(RunDirective.Stop);
    expect(fixture.progress.ends).toEqual([]);
  });

  it.each([
    [Phase.Pending, Phase.Pending],
    [Phase.Running, Phase.Waiting],
    [Phase.Waiting, Phase.Waiting],
    [Phase.Suspended, Phase.Suspended],
    [Phase.Cancelled, Phase.Cancelled],
    [Phase.Faulted, Phase.Faulted],
    [Phase.Completed, Phase.Completed],
  ])('a_wait_that_begins_on_a_%s_instance_leaves_it_%s', async (from, to) => {
    const fixture = setUp(anInstanceIn(from));

    await fixture.waiting.execute(ofInstance);

    expect(fixture.instances.phaseOf('instance-1')).toBe(to);
  });

  it.each([
    [Phase.Pending, Phase.Pending],
    [Phase.Running, Phase.Running],
    [Phase.Waiting, Phase.Running],
    [Phase.Suspended, Phase.Suspended],
    [Phase.Cancelled, Phase.Cancelled],
    [Phase.Faulted, Phase.Faulted],
    [Phase.Completed, Phase.Completed],
  ])('a_wait_that_ends_on_a_%s_instance_leaves_it_%s', async (from, to) => {
    const fixture = setUp(anInstanceIn(from));

    await fixture.running.execute(ofInstance);

    expect(fixture.instances.phaseOf('instance-1')).toBe(to);
  });

  it.each([
    [Phase.Pending, RunDirective.Continue],
    [Phase.Running, RunDirective.Continue],
    [Phase.Waiting, RunDirective.Continue],
    [Phase.Suspended, RunDirective.Suspend],
    [Phase.Cancelled, RunDirective.Stop],
    [Phase.Faulted, RunDirective.Stop],
    [Phase.Completed, RunDirective.Stop],
  ])('a_held_run_of_a_%s_instance_is_told_to_%s', async (phase, expected) => {
    const fixture = setUp(anInstanceIn(phase));

    const directive = await fixture.directive.execute(ofInstance);

    expect(directive).toBe(expected);
    expect(fixture.instances.saves).toBe(0);
  });

  it('a_resume_releases_a_held_run', async () => {
    const fixture = setUp(anInstanceIn(Phase.Suspended));
    const held = await fixture.directive.execute(ofInstance);

    await fixture.resume.execute(ofInstance);
    const released = await fixture.directive.execute(ofInstance);

    expect(held).toBe(RunDirective.Suspend);
    expect(released).toBe(RunDirective.Continue);
  });

  it.each(OPEN)('a_%s_instance_completes_with_its_output', async (phase) => {
    const fixture = setUp(anInstanceIn(phase));

    await fixture.complete.execute({
      instanceId: 'instance-1',
      output: { routed: true },
      error: null,
    });

    const row = fixture.instances.rows.get('instance-1');
    expect(row?.phase).toBe(Phase.Completed);
    expect(row?.output).toEqual({ routed: true });
    expect(row?.endedAt).toBe(now);
    expect(fixture.instances.outbox).toEqual([
      { kind: InstanceEventKind.Completed, instanceId: 'instance-1' },
    ]);
  });

  it.each(ENDED)(
    'a_completion_of_a_%s_instance_changes_nothing',
    async (phase) => {
      const fixture = setUp(anInstanceIn(phase));

      await fixture.complete.execute({
        instanceId: 'instance-1',
        output: { late: true },
        error: null,
      });

      const row = fixture.instances.rows.get('instance-1');
      expect(row?.phase).toBe(phase);
      expect(row?.output).toBeNull();
      expect(row?.endedAt).toBe(T0);
      expect(fixture.instances.outbox).toEqual([]);
    },
  );

  it('the_tasks_still_running_when_a_run_completes_end_cancelled', async () => {
    const fixture = setUp(anInstanceIn(Phase.Running));

    await fixture.complete.execute({
      instanceId: 'instance-1',
      output: { routed: true },
      error: null,
    });

    expect(fixture.progress.cancellations).toEqual([
      { instanceId: 'instance-1', at: now },
    ]);
  });

  it('the_tasks_still_running_when_a_run_faults_end_cancelled', async () => {
    const fixture = setUp(anInstanceIn(Phase.Running));

    await fixture.fault.execute({
      instanceId: 'instance-1',
      output: null,
      error: { type: 'runtime', status: 500 },
    });

    expect(fixture.progress.cancellations).toEqual([
      { instanceId: 'instance-1', at: now },
    ]);
  });

  it.each(OPEN)('a_%s_instance_faults_with_its_error', async (phase) => {
    const fixture = setUp(anInstanceIn(phase));

    await fixture.fault.execute({
      instanceId: 'instance-1',
      output: null,
      error: { type: 'runtime', status: 500 },
    });

    const row = fixture.instances.rows.get('instance-1');
    expect(row?.phase).toBe(Phase.Faulted);
    expect(row?.error).toEqual({ type: 'runtime', status: 500 });
    expect(row?.endedAt).toBe(now);
    expect(fixture.instances.outbox).toEqual([
      { kind: InstanceEventKind.Faulted, instanceId: 'instance-1' },
    ]);
  });

  it('a_fault_without_an_error_keeps_an_empty_one', async () => {
    const fixture = setUp(anInstanceIn(Phase.Running));

    await fixture.fault.execute({
      instanceId: 'instance-1',
      output: null,
      error: null,
    });

    expect(fixture.instances.rows.get('instance-1')?.error).toEqual({});
  });

  it.each(ENDED)('a_fault_of_a_%s_instance_changes_nothing', async (phase) => {
    const fixture = setUp(anInstanceIn(phase));

    await fixture.fault.execute({
      instanceId: 'instance-1',
      output: null,
      error: { type: 'late' },
    });

    const row = fixture.instances.rows.get('instance-1');
    expect(row?.phase).toBe(phase);
    expect(row?.error).toBeNull();
    expect(row?.endedAt).toBe(T0);
    expect(fixture.instances.outbox).toEqual([]);
  });

  it('a_fault_after_a_completion_keeps_the_completion', async () => {
    const fixture = setUp(anInstanceIn(Phase.Running));
    await fixture.complete.execute({
      instanceId: 'instance-1',
      output: { first: true },
      error: null,
    });

    await fixture.fault.execute({
      instanceId: 'instance-1',
      output: null,
      error: { type: 'late' },
    });

    const row = fixture.instances.rows.get('instance-1');
    expect(row?.phase).toBe(Phase.Completed);
    expect(row?.output).toEqual({ first: true });
    expect(row?.error).toBeNull();
  });

  it('a_completion_after_a_cancel_keeps_the_cancel', async () => {
    const fixture = setUp(anInstanceIn(Phase.Running));
    await fixture.cancel.execute(ofInstance);

    await fixture.complete.execute({
      instanceId: 'instance-1',
      output: { late: true },
      error: null,
    });

    const row = fixture.instances.rows.get('instance-1');
    expect(row?.phase).toBe(Phase.Cancelled);
    expect(row?.output).toBeNull();
    expect(fixture.instances.outbox).toHaveLength(1);
  });

  it('a_whole_run_goes_pending_running_waiting_running_completed', async () => {
    const fixture = setUp(anInstanceIn(Phase.Pending));
    const phases: (Phase | undefined)[] = [];

    await fixture.begin.execute(ofInstance);
    phases.push(fixture.instances.phaseOf('instance-1'));
    await fixture.waiting.execute(ofInstance);
    phases.push(fixture.instances.phaseOf('instance-1'));
    await fixture.running.execute(ofInstance);
    phases.push(fixture.instances.phaseOf('instance-1'));
    await fixture.complete.execute({
      instanceId: 'instance-1',
      output: 1,
      error: null,
    });
    phases.push(fixture.instances.phaseOf('instance-1'));

    expect(phases).toEqual([
      Phase.Running,
      Phase.Waiting,
      Phase.Running,
      Phase.Completed,
    ]);
    const kinds = fixture.instances.outbox.map((event) => event.kind);
    expect(kinds).toEqual([
      InstanceEventKind.Started,
      InstanceEventKind.Completed,
    ]);
  });

  it('every_runtime_report_of_a_deleted_instance_is_quiet_and_writes_nothing', async () => {
    const fixture = setUp();
    const end = { instanceId: 'gone', output: 1, error: null };

    const begun = await fixture.begin.execute(ofUnknown);
    const held = await fixture.directive.execute(ofUnknown);
    await fixture.waiting.execute(ofUnknown);
    await fixture.running.execute(ofUnknown);
    await fixture.complete.execute(end);
    await fixture.fault.execute(end);

    expect(begun).toBe(RunDirective.Stop);
    expect(held).toBe(RunDirective.Stop);
    expect(fixture.instances.saves).toBe(0);
    expect(fixture.instances.rows.size).toBe(0);
  });
});
