import { CompleteInstance } from '../../../../src/application/automation/instances/complete-instance.js';
import { StartScheduledInstance } from '../../../../src/application/automation/schedules/start-scheduled-instance.js';
import { SyncSchedule } from '../../../../src/application/automation/schedules/sync-schedule.js';
import { TurnWorkflowOff } from '../../../../src/application/automation/workflows/turn-workflow-off.js';
import { TurnWorkflowOn } from '../../../../src/application/automation/workflows/turn-workflow-on.js';
import {
  Phase,
  TriggerKind,
} from '../../../../src/domain/automation/instances/enums.js';
import { WorkflowRefusal } from '../../../../src/domain/automation/workflows/enums.js';
import { Workflow } from '../../../../src/domain/automation/workflows/workflow.js';
import { WorkflowName } from '../../../../src/domain/automation/workflows/workflow-name.js';
import type { WorkflowVersion } from '../../../../src/domain/automation/workflows/workflow-version.js';
import { aDefinition } from '../../../support/builders.js';
import {
  anInstanceIn,
  FixedClock,
  RecordingInstanceRuns,
  RecordingSchedules,
  RecordingTaskProgress,
  StoredWorkflowInstanceRepository,
  StoredWorkflowRepository,
  StoredWorkflowVersionRepository,
  T0,
} from '../../../support/qa-fakes.js';

const name = new WorkflowName('sales', 'route-lead');

function setUp() {
  const clock = new FixedClock(T0);
  const workflows = new StoredWorkflowRepository();
  const versions = new StoredWorkflowVersionRepository(workflows);
  const instances = new StoredWorkflowInstanceRepository();
  const runs = new RecordingInstanceRuns(instances);
  const progress = new RecordingTaskProgress(instances);
  const schedules = new RecordingSchedules();
  return {
    workflows,
    versions,
    instances,
    runs,
    schedules,
    turnOn: new TurnWorkflowOn(workflows),
    turnOff: new TurnWorkflowOff(workflows),
    sync: new SyncSchedule(workflows, versions, schedules),
    scheduled: new StartScheduledInstance(
      workflows,
      versions,
      instances,
      runs,
      clock,
    ),
    complete: new CompleteInstance(
      instances,
      progress,
      versions,
      schedules,
      clock,
    ),
  };
}

type Fixture = ReturnType<typeof setUp>;

// A stored workflow with one published version, on or off.
async function aWorkflow(
  fixture: Fixture,
  on: boolean,
): Promise<{ workflow: Workflow; version: WorkflowVersion }> {
  const workflow = Workflow.register(name);
  const definition = aDefinition({}, 'content-1');
  const result = workflow.publish({
    definition,
    existing: null,
    publisherId: 'author-1',
    now: T0,
  });

  if (!result.ok) throw new Error(result.failure);

  if (on) workflow.turnOn();

  await fixture.workflows.save(workflow);
  await fixture.versions.add(result.value.version);
  return { workflow, version: result.value.version };
}

describe('turning a workflow on and off', () => {
  it('turning_on_saves_once_and_turning_on_again_writes_nothing', async () => {
    const fixture = setUp();
    await aWorkflow(fixture, false);
    const before = fixture.workflows.saves;

    await fixture.turnOn.execute({ name });
    await fixture.turnOn.execute({ name });

    expect(fixture.workflows.saves).toBe(before + 1);
  });

  it('turning_off_a_workflow_that_is_off_writes_nothing', async () => {
    const fixture = setUp();
    await aWorkflow(fixture, false);
    const before = fixture.workflows.saves;

    const result = await fixture.turnOff.execute({ name });

    expect(result.ok).toBe(true);
    expect(fixture.workflows.saves).toBe(before);
  });
});

describe('the engine learns a changed schedule', () => {
  it('a_workflow_that_is_on_applies_its_current_versions_schedule', async () => {
    const fixture = setUp();
    const { workflow, version } = await aWorkflow(fixture, true);

    await fixture.sync.execute({ workflowId: workflow.id });

    expect(fixture.schedules.applied).toEqual([`${workflow.id}@${version.id}`]);
  });

  it('a_workflow_that_is_off_clears_its_schedule', async () => {
    const fixture = setUp();
    const { workflow } = await aWorkflow(fixture, false);

    await fixture.sync.execute({ workflowId: workflow.id });

    expect(fixture.schedules.cleared).toEqual([workflow.id]);
    expect(fixture.schedules.applied).toEqual([]);
  });
});

describe('an occurrence of a schedule', () => {
  it('starts_one_instance_named_by_the_occurrence_and_a_repeat_finds_it', async () => {
    const fixture = setUp();
    const { workflow } = await aWorkflow(fixture, true);
    const command = {
      workflowId: workflow.id,
      instanceId: '0b7c2f7e-0000-4000-8000-000000000001',
      chained: false,
    };

    await fixture.scheduled.execute(command);
    await fixture.scheduled.execute(command);

    expect(fixture.instances.rows.size).toBe(1);
    expect(fixture.runs.started).toHaveLength(1);
    expect(fixture.runs.started[0]?.stored).toBe(true);
  });

  it('starts_nothing_once_the_workflow_is_off', async () => {
    const fixture = setUp();
    const { workflow } = await aWorkflow(fixture, false);

    const result = await fixture.scheduled.execute({
      workflowId: workflow.id,
      instanceId: '0b7c2f7e-0000-4000-8000-000000000002',
      chained: false,
    });

    expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Off });
    expect(fixture.instances.rows.size).toBe(0);
  });

  it('a_chained_one_starts_nothing_while_the_schedules_instance_runs', async () => {
    const fixture = setUp();
    const { workflow, version } = await aWorkflow(fixture, true);
    const running = anInstanceIn(Phase.Running, {
      id: 'running-1',
      workflowId: workflow.id,
      versionId: version.id,
      trigger: TriggerKind.Schedule,
    });
    fixture.instances.put(running);

    const result = await fixture.scheduled.execute({
      workflowId: workflow.id,
      instanceId: '0b7c2f7e-0000-4000-8000-000000000003',
      chained: true,
    });

    expect(result).toEqual({ ok: true, value: null });
    expect(fixture.instances.rows.size).toBe(1);
  });
});

describe('the next link of an after chain', () => {
  it('a_completed_instance_its_schedule_started_asks_for_the_next', async () => {
    const fixture = setUp();
    const { workflow, version } = await aWorkflow(fixture, true);
    fixture.instances.put(
      anInstanceIn(Phase.Running, {
        workflowId: workflow.id,
        versionId: version.id,
        trigger: TriggerKind.Schedule,
      }),
    );

    await fixture.complete.execute({
      instanceId: 'instance-1',
      output: {},
      error: null,
    });

    expect(fixture.schedules.continued).toEqual([
      { instanceId: 'instance-1', versionId: version.id },
    ]);
  });

  it('a_manual_instance_asks_for_nothing', async () => {
    const fixture = setUp();
    const { workflow, version } = await aWorkflow(fixture, true);
    fixture.instances.put(
      anInstanceIn(Phase.Running, {
        workflowId: workflow.id,
        versionId: version.id,
      }),
    );

    await fixture.complete.execute({
      instanceId: 'instance-1',
      output: {},
      error: null,
    });

    expect(fixture.schedules.continued).toEqual([]);
  });
});
