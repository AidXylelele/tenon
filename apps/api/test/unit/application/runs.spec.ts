import {
  RunQueries,
  type RunView,
} from '../../../src/application/interfaces.js';
import { WorkflowPolicy } from '../../../src/application/policies/workflow.policy.js';
import { ConfigurationCheck } from '../../../src/application/services/configuration-check.js';
import { BeginRun } from '../../../src/application/use-cases/begin-run.js';
import { CancelRun } from '../../../src/application/use-cases/cancel-run.js';
import { ExecuteNode } from '../../../src/application/use-cases/execute-node.js';
import { FinishRun } from '../../../src/application/use-cases/finish-run.js';
import { ReachNode } from '../../../src/application/use-cases/reach-node.js';
import { ReadStepOutput } from '../../../src/application/use-cases/read-step-output.js';
import { RecordNode } from '../../../src/application/use-cases/record-node.js';
import { StartManualRun } from '../../../src/application/use-cases/start-manual-run.js';
import { StartTestRun } from '../../../src/application/use-cases/start-test-run.js';
import { TerminateRun } from '../../../src/application/use-cases/terminate-run.js';
import {
  Arrival,
  ErrorKind,
  ProblemCode,
  Role,
  RunMode,
  RunStatus,
  StepStatus,
} from '../../../src/domain/enums.js';
import {
  NodeConfigurationError,
  RunFinishedError,
  WorkflowAccessDeniedError,
} from '../../../src/domain/errors.js';
import type { NodeFailure } from '../../../src/domain/interfaces.js';
import { Workflow } from '../../../src/domain/workflow.js';
import {
  aGraph,
  aNode,
  aTrigger,
  defaultSettings,
  link,
} from '../../support/automation-builders.js';
import {
  FakeNodeTypeCatalog,
  InMemoryArtifactStore,
  InMemoryNodeSamples,
  InMemoryReleaseRepository,
  InMemoryRunRepository,
  InMemoryWorkflowRepository,
  ScriptedNodeExecutor,
} from '../../support/automation-fakes.js';
import { aUser } from '../../support/builders.js';

const owner = aUser({ id: 'owner-1', role: Role.Editor });
const stranger = aUser({ id: 'editor-2', role: Role.Editor });
const policy = new WorkflowPolicy();
const LIMITS = { runBytes: 1_000_000 };

const failure: NodeFailure = {
  kind: ErrorKind.User,
  message: 'Broken',
  parameter: null,
  item: null,
  typeUnavailable: false,
};

const world = () => {
  const workflow = Workflow.create({ name: 'Orders', ownerId: owner.id });
  workflow.saveDraft(
    1,
    aGraph(
      [
        aTrigger('start'),
        aNode('a', {
          settings: defaultSettings({ retry: { attempts: 2, waitMs: 250 } }),
        }),
        aNode('b'),
      ],
      [link('start', 'a'), link('a', 'b')],
    ),
    workflow.settings,
  );
  const workflows = new InMemoryWorkflowRepository(workflow);
  const releases = new InMemoryReleaseRepository();
  const runs = new InMemoryRunRepository();
  const artifacts = new InMemoryArtifactStore();
  const samples = new InMemoryNodeSamples();
  const catalogue = new FakeNodeTypeCatalog();
  const executor = new ScriptedNodeExecutor();
  const startTestRun = new StartTestRun(
    workflows,
    runs,
    artifacts,
    samples,
    new ConfigurationCheck(catalogue),
    policy,
  );
  const test = (actor = owner) =>
    startTestRun.execute({
      actor,
      workflowId: workflow.id,
      revision: 2,
      triggerNodeId: 'start',
      items: [{ id: 1 }, { id: 2 }],
    });
  return {
    workflow,
    workflows,
    releases,
    runs,
    artifacts,
    samples,
    catalogue,
    executor,
    test,
  };
};

describe('starting runs', () => {
  it('the_owner_starts_a_test_run_whose_trigger_hands_on_the_given_items', async () => {
    const { runs, artifacts, test } = world();
    const run = await test();
    expect(runs.runs.get(run.id)).toBe(run);
    expect(run.mode).toBe(RunMode.Test);
    expect(run.status).toBe(RunStatus.Queued);
    expect(await artifacts.readAll(run.input)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(run.input[0]?.key).toBe(`runs/${run.id}/nodes/start/a0/main`);
  });

  it('a_run_started_without_items_hands_on_one_empty_item', async () => {
    const { workflow, runs, artifacts, samples, catalogue } = world();
    const run = await new StartTestRun(
      new InMemoryWorkflowRepository(workflow),
      runs,
      artifacts,
      samples,
      new ConfigurationCheck(catalogue),
      policy,
    ).execute({
      actor: owner,
      workflowId: workflow.id,
      revision: 2,
      triggerNodeId: 'start',
      items: [],
    });
    expect(await artifacts.readAll(run.input)).toEqual([{}]);
  });

  it('a_test_run_takes_the_pins_of_the_draft_with_it', async () => {
    const { workflow, samples, artifacts, test } = world();
    workflow.pin('a');
    await samples.pin(workflow.id, 'a', [{ pinned: true }]);
    const run = await test();
    expect(run.pins.map((pin) => pin.nodeId)).toEqual(['a']);
    expect(await artifacts.readAll(run.pins[0]!.outputs)).toEqual([
      { pinned: true },
    ]);
  });

  it('a_test_run_of_a_draft_with_configuration_problems_is_refused', async () => {
    const { catalogue, runs, test } = world();
    catalogue.failing('a', {
      nodeId: 'a',
      parameter: null,
      code: ProblemCode.UnknownNodeType,
      message: 'Unknown',
    });
    await expect(test()).rejects.toBeInstanceOf(NodeConfigurationError);
    expect(runs.runs.size).toBe(0);
  });

  it('only_the_owner_or_an_administrator_starts_runs', async () => {
    const { test } = world();
    await expect(test(stranger)).rejects.toBeInstanceOf(
      WorkflowAccessDeniedError,
    );
  });

  it('a_manual_run_of_a_release_runs_its_graph', async () => {
    const { workflow, workflows, releases, runs, artifacts } = world();
    const release = workflow.publish(2, [], owner.id);
    await releases.add(release);
    const run = await new StartManualRun(
      workflows,
      releases,
      runs,
      artifacts,
      policy,
    ).execute({
      actor: owner,
      workflowId: workflow.id,
      releaseNumber: 1,
      triggerNodeId: 'start',
      items: [{ id: 9 }],
    });
    expect(run.mode).toBe(RunMode.Production);
    expect(run.releaseNumber).toBe(1);
    expect(await artifacts.readAll(run.input)).toEqual([{ id: 9 }]);
  });
});

describe('executing runs', () => {
  it('the_engine_steps_walk_the_run_from_its_trigger_to_its_end', async () => {
    const { runs, executor, samples, test } = world();
    const run = await test();
    const order = await new BeginRun(runs).execute(run.id);
    expect(order).toEqual(['start', 'a', 'b']);
    expect(run.status).toBe(RunStatus.Running);

    const reach = new ReachNode(runs);
    expect(await reach.execute(run.id, 'start')).toBe(Arrival.Done);
    expect(await reach.execute(run.id, 'a')).toBe(Arrival.Execute);

    const produced = {
      port: 'main',
      items: 2,
      bytes: 20,
      key: 'out-a',
      chunkStarts: [0],
    };
    executor.answer('a', {
      outputs: [produced],
      failure: null,
      fields: [{ path: 'id', type: 'number' }],
    });
    const attempt = await new ExecuteNode(runs, executor).execute(
      run.id,
      'a',
      1,
    );
    expect(attempt.retryInMs).toBeNull();
    expect(executor.assignments[0]?.input.node.id).toBe('a');
    expect(executor.assignments[0]?.attempt).toBe(1);

    await new RecordNode(runs, samples, LIMITS).execute(
      run.id,
      'a',
      1,
      attempt.outcome,
    );
    expect(run.step('a')?.status).toBe(StepStatus.Succeeded);
    expect(samples.fields.get(`${run.workflowId}/a`)).toEqual([
      { path: 'id', type: 'number' },
    ]);

    expect(await reach.execute(run.id, 'b')).toBe(Arrival.Execute);
    await new RecordNode(runs, samples, LIMITS).execute(run.id, 'b', 1, {
      outputs: [],
      failure: null,
      fields: [],
    });
    await new FinishRun(runs).execute(run.id);
    expect(run.status).toBe(RunStatus.Succeeded);
  });

  it('a_failed_attempt_is_retried_after_the_wait_the_node_asks_for', async () => {
    const { runs, executor, test } = world();
    const run = await test();
    await new BeginRun(runs).execute(run.id);
    await new ReachNode(runs).execute(run.id, 'start');
    await new ReachNode(runs).execute(run.id, 'a');
    executor.answer('a', { outputs: [], failure, fields: [] });
    const execute = new ExecuteNode(runs, executor);
    expect((await execute.execute(run.id, 'a', 1)).retryInMs).toBe(250);
    expect((await execute.execute(run.id, 'a', 2)).retryInMs).toBeNull();
  });

  it('a_failure_is_recorded_on_the_node_and_ends_the_run', async () => {
    const { runs, samples, test } = world();
    const run = await test();
    await new BeginRun(runs).execute(run.id);
    await new ReachNode(runs).execute(run.id, 'start');
    await new ReachNode(runs).execute(run.id, 'a');
    await new RecordNode(runs, samples, LIMITS).execute(run.id, 'a', 2, {
      outputs: [],
      failure,
      fields: [],
    });
    expect(run.status).toBe(RunStatus.Failed);
    expect(run.step('a')?.attempts).toBe(2);
  });

  it('an_engine_side_end_terminates_the_run', async () => {
    const { runs, test } = world();
    const run = await test();
    await new TerminateRun(runs).execute(run.id, {
      kind: ErrorKind.Timeout,
      message: 'The run timed out',
    });
    expect(run.status).toBe(RunStatus.Failed);
    expect(run.error).toEqual({
      nodeId: null,
      kind: ErrorKind.Timeout,
      message: 'The run timed out',
    });
  });
});

describe('cancelling and reading runs', () => {
  it('the_owner_cancels_a_run_once', async () => {
    const { workflows, runs, test } = world();
    const run = await test();
    const cancel = new CancelRun(runs, workflows, policy);
    await expect(
      cancel.execute({ actor: stranger, runId: run.id }),
    ).rejects.toBeInstanceOf(WorkflowAccessDeniedError);
    await cancel.execute({ actor: owner, runId: run.id });
    expect(run.status).toBe(RunStatus.Cancelled);
    await expect(
      cancel.execute({ actor: owner, runId: run.id }),
    ).rejects.toBeInstanceOf(RunFinishedError);
  });

  it('a_node_that_finishes_after_the_run_was_cancelled_keeps_its_output', async () => {
    const { workflows, runs, samples, test } = world();
    const run = await test();
    await new BeginRun(runs).execute(run.id);
    await new ReachNode(runs).execute(run.id, 'start');
    await new ReachNode(runs).execute(run.id, 'a');
    await new CancelRun(runs, workflows, policy).execute({
      actor: owner,
      runId: run.id,
    });
    const produced = {
      port: 'main',
      items: 1,
      bytes: 10,
      key: 'out-a',
      chunkStarts: [0],
    };
    await new RecordNode(runs, samples, LIMITS).execute(run.id, 'a', 1, {
      outputs: [produced],
      failure: null,
      fields: [],
    });
    expect(run.status).toBe(RunStatus.Cancelled);
    expect(run.step('a')?.status).toBe(StepStatus.Succeeded);
    expect(run.step('a')?.outputs).toEqual([produced]);
    expect(await new ReachNode(runs).execute(run.id, 'b')).toBe(Arrival.Stop);
  });

  it('a_node_reached_before_the_run_was_cancelled_does_not_start_after_it', async () => {
    const { workflows, runs, executor, test } = world();
    const run = await test();
    await new BeginRun(runs).execute(run.id);
    await new ReachNode(runs).execute(run.id, 'start');
    await new ReachNode(runs).execute(run.id, 'a');
    await new CancelRun(runs, workflows, policy).execute({
      actor: owner,
      runId: run.id,
    });
    const attempt = await new ExecuteNode(runs, executor).execute(
      run.id,
      'a',
      1,
    );
    expect(executor.assignments).toEqual([]);
    expect(attempt).toEqual({
      outcome: {
        outputs: [],
        failure: expect.objectContaining({ kind: ErrorKind.Cancelled }),
        fields: [],
      },
      retryInMs: null,
    });
  });

  it('a_step_output_is_read_page_by_page_across_its_segments', async () => {
    const { artifacts } = world();
    const first = await artifacts.write(
      { runId: 'r', nodeId: 'a', attempt: 1, port: 'main' },
      [{ n: 1 }, { n: 2 }],
    );
    const second = await artifacts.write(
      { runId: 'r', nodeId: 'b', attempt: 1, port: 'main' },
      [{ n: 3 }],
    );
    const view: RunView = {
      id: 'r',
      workflowId: 'wf',
      status: RunStatus.Succeeded,
      mode: RunMode.Test,
      trigger: aTrigger('start').trigger!,
      releaseNumber: null,
      queuedAt: new Date(),
      startedAt: null,
      finishedAt: null,
      error: null,
      version: 1,
      steps: [
        {
          nodeId: 'off',
          status: StepStatus.Succeeded,
          attempts: 0,
          startedAt: null,
          finishedAt: null,
          outputs: [first, second, { ...first, port: 'other' }],
          error: null,
        },
      ],
    };
    class OneRun extends RunQueries {
      list = () => Promise.resolve({ items: [], nextCursor: null });
      unfinishedBefore = () => Promise.resolve([]);
      get = () => Promise.resolve(view);
    }
    const page = await new ReadStepOutput(new OneRun(), artifacts).execute({
      runId: 'r',
      nodeId: 'off',
      port: 'main',
      offset: 1,
      limit: 5,
    });
    expect(page).toEqual({ items: [{ n: 2 }, { n: 3 }], total: 3, offset: 1 });
  });
});
