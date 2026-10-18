import { WorkflowPolicy } from '../../../src/application/policies/workflow.policy.js';
import { ConfigurationCheck } from '../../../src/application/services/configuration-check.js';
import { ActivateRelease } from '../../../src/application/use-cases/activate-release.js';
import { DeactivateWorkflow } from '../../../src/application/use-cases/deactivate-workflow.js';
import { ListActiveSchedules } from '../../../src/application/use-cases/list-active-schedules.js';
import { StartScheduledRun } from '../../../src/application/use-cases/start-scheduled-run.js';
import {
  ProblemCode,
  Role,
  RunMode,
  TriggerType,
} from '../../../src/domain/enums.js';
import {
  NodeConfigurationError,
  ReleaseNotFoundError,
  ReleaseWithoutTriggerError,
  WorkflowAccessDeniedError,
} from '../../../src/domain/errors.js';
import type { NodeProps } from '../../../src/domain/interfaces.js';
import { Workflow } from '../../../src/domain/workflow.js';
import {
  aGraph,
  aNode,
  aTrigger,
  link,
} from '../../support/automation-builders.js';
import {
  FakeNodeTypeCatalog,
  InMemoryArtifactStore,
  InMemoryReleaseRepository,
  InMemoryRunRepository,
  InMemoryWorkflowQueries,
  InMemoryWorkflowRepository,
} from '../../support/automation-fakes.js';
import { aUser } from '../../support/builders.js';

const owner = aUser({ id: 'owner-1', role: Role.Editor });
const stranger = aUser({ id: 'editor-2', role: Role.Editor });
const policy = new WorkflowPolicy();

const scheduled = () =>
  aTrigger('tick', { type: 'scheduleTrigger', trigger: TriggerType.Schedule });

const world = (trigger = scheduled(), extra: NodeProps[] = []) => {
  const workflow = Workflow.create({ name: 'Orders', ownerId: owner.id });
  workflow.saveDraft(
    1,
    aGraph(
      [trigger, ...extra, aNode('a')],
      [trigger, ...extra].map((node) => link(node.id, 'a')),
    ),
    { timezone: 'Europe/Kyiv', runTimeoutMs: 60_000, errorWorkflowId: null },
  );
  const release = workflow.publish(2, [], owner.id);
  const workflows = new InMemoryWorkflowRepository(workflow);
  const releases = new InMemoryReleaseRepository(release);
  const catalogue = new FakeNodeTypeCatalog().schedules([
    { kind: 'rrule', expression: 'FREQ=MINUTELY;INTERVAL=5', timezone: null },
    { kind: 'cron', expression: '0 9 * * 1', timezone: 'UTC' },
  ]);
  const activate = new ActivateRelease(
    workflows,
    releases,
    new ConfigurationCheck(catalogue),
    policy,
  );
  const runs = new InMemoryRunRepository();
  const artifacts = new InMemoryArtifactStore();
  const startScheduled = new StartScheduledRun(
    workflows,
    releases,
    runs,
    artifacts,
  );
  const schedules = new ListActiveSchedules(
    new InMemoryWorkflowQueries(workflows, owner, releases),
    catalogue,
  );
  return {
    workflow,
    workflows,
    catalogue,
    activate,
    runs,
    artifacts,
    startScheduled,
    schedules,
  };
};

describe('activation', () => {
  it('the_owner_activates_a_release_and_the_change_is_announced', async () => {
    const { workflow, workflows, activate } = world();
    await activate.execute({
      actor: owner,
      workflowId: workflow.id,
      releaseNumber: 1,
    });
    expect(workflow.activeRelease).toBe(1);
    expect(workflows.published).toEqual([{ workflowId: workflow.id }]);
  });

  it('a_release_whose_nodes_have_problems_now_is_not_activated', async () => {
    const { workflow, catalogue, activate } = world();
    catalogue.failing('a', {
      nodeId: 'a',
      parameter: null,
      code: ProblemCode.UnknownNodeType,
      message: 'Unknown',
    });
    await expect(
      activate.execute({
        actor: owner,
        workflowId: workflow.id,
        releaseNumber: 1,
      }),
    ).rejects.toBeInstanceOf(NodeConfigurationError);
    expect(workflow.activeRelease).toBeNull();
  });

  it('only_an_existing_release_with_a_trigger_is_activated_by_its_owner', async () => {
    const { workflow, activate } = world();
    await expect(
      activate.execute({
        actor: owner,
        workflowId: workflow.id,
        releaseNumber: 9,
      }),
    ).rejects.toBeInstanceOf(ReleaseNotFoundError);
    await expect(
      activate.execute({
        actor: stranger,
        workflowId: workflow.id,
        releaseNumber: 1,
      }),
    ).rejects.toBeInstanceOf(WorkflowAccessDeniedError);
    const untriggered = world(aNode('start'));
    await expect(
      untriggered.activate.execute({
        actor: owner,
        workflowId: untriggered.workflow.id,
        releaseNumber: 1,
      }),
    ).rejects.toBeInstanceOf(ReleaseWithoutTriggerError);
  });

  it('deactivating_ends_the_activation_and_announces_it', async () => {
    const { workflow, workflows, activate } = world();
    await activate.execute({
      actor: owner,
      workflowId: workflow.id,
      releaseNumber: 1,
    });
    await new DeactivateWorkflow(workflows, policy).execute({
      actor: owner,
      workflowId: workflow.id,
    });
    expect(workflow.activeRelease).toBeNull();
    expect(workflows.published).toHaveLength(2);
  });
});

describe('schedules', () => {
  it('an_active_release_has_one_schedule_per_rule_of_each_schedule_trigger', async () => {
    const { workflow, activate, schedules } = world();
    expect(await schedules.execute(workflow.id)).toEqual([]);
    await activate.execute({
      actor: owner,
      workflowId: workflow.id,
      releaseNumber: 1,
    });
    expect(await schedules.execute(workflow.id)).toEqual([
      {
        workflowId: workflow.id,
        releaseNumber: 1,
        nodeId: 'tick',
        rule: 0,
        kind: 'rrule',
        expression: 'FREQ=MINUTELY;INTERVAL=5',
        timezone: 'Europe/Kyiv',
      },
      {
        workflowId: workflow.id,
        releaseNumber: 1,
        nodeId: 'tick',
        rule: 1,
        kind: 'cron',
        expression: '0 9 * * 1',
        timezone: 'UTC',
      },
    ]);
  });

  it('a_disabled_schedule_trigger_has_no_schedule', async () => {
    const off = aTrigger('tick', {
      type: 'scheduleTrigger',
      trigger: TriggerType.Schedule,
      disabled: true,
    });
    const { workflow, activate, schedules } = world(aTrigger('start'), [off]);
    await activate.execute({
      actor: owner,
      workflowId: workflow.id,
      releaseNumber: 1,
    });
    expect(await schedules.execute(workflow.id)).toEqual([]);
  });

  it('a_release_whose_only_trigger_is_disabled_is_not_activated', async () => {
    const { workflow, activate } = world(
      aTrigger('tick', {
        type: 'scheduleTrigger',
        trigger: TriggerType.Schedule,
        disabled: true,
      }),
    );
    await expect(
      activate.execute({
        actor: owner,
        workflowId: workflow.id,
        releaseNumber: 1,
      }),
    ).rejects.toBeInstanceOf(ReleaseWithoutTriggerError);
  });

  it('an_occurrence_starts_one_production_run_with_its_time_as_the_input', async () => {
    const { workflow, activate, startScheduled, runs, artifacts } = world();
    await activate.execute({
      actor: owner,
      workflowId: workflow.id,
      releaseNumber: 1,
    });
    const occurrence = {
      workflowId: workflow.id,
      releaseNumber: 1,
      nodeId: 'tick',
      occurrence: 'wf.x.tick.0@2026-10-16T09:00:00.000Z',
      at: new Date('2026-10-16T09:00:00.000Z'),
    };
    const run = await startScheduled.execute(occurrence);
    expect(run).toMatchObject({
      mode: RunMode.Production,
      releaseNumber: 1,
      trigger: { type: TriggerType.Schedule, nodeId: 'tick' },
    });
    expect(await artifacts.readAll(run!.input)).toEqual([
      { timestamp: '2026-10-16T09:00:00.000Z' },
    ]);
    const again = await startScheduled.execute(occurrence);
    expect(again?.id).toBe(run?.id);
    expect(runs.runs.size).toBe(1);
  });

  it('an_occurrence_of_a_release_that_is_no_longer_active_starts_nothing', async () => {
    const { workflow, startScheduled, runs } = world();
    const run = await startScheduled.execute({
      workflowId: workflow.id,
      releaseNumber: 1,
      nodeId: 'tick',
      occurrence: 'wf.x.tick.0@2026-10-16T09:00:00.000Z',
      at: new Date('2026-10-16T09:00:00.000Z'),
    });
    expect(run).toBeNull();
    expect(runs.runs.size).toBe(0);
  });
});
