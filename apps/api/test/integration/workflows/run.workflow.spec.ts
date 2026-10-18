import {
  ManualWorkflowClock,
  WORKFLOWS_MODULE_OPTIONS,
  WorkflowClient,
  WorkflowWorker,
} from '@nestjs/workflows';
import { TransactionHost } from '@nestjs-cls/transactional';
import {
  ArtifactStore,
  RunQueries,
  RunRepository,
  WorkflowRepository,
} from '../../../src/application/interfaces.js';
import { CancelRun } from '../../../src/application/use-cases/cancel-run.js';
import { StartTestRun } from '../../../src/application/use-cases/start-test-run.js';
import {
  ErrorKind,
  Role,
  RunStatus,
  StepStatus,
} from '../../../src/domain/enums.js';
import type { NodeProps } from '../../../src/domain/interfaces.js';
import { Run } from '../../../src/domain/run.js';
import type { User } from '../../../src/domain/user.js';
import { Workflow } from '../../../src/domain/workflow.js';
import { MaintenanceWorkflow } from '../../../src/interface-adapters/workflows/maintenance.workflow.js';
import { RunLauncher } from '../../../src/interface-adapters/workflows/run-launcher.js';
import { createUser } from '../../support/auth-helpers.js';
import {
  aGraph,
  aNode,
  aTrigger,
  defaultSettings,
  link,
} from '../../support/automation-builders.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';

const items = [
  { name: 'kibble', price: 10 },
  { name: 'litter', price: 25 },
];

const refusing = (waitMs: number): NodeProps =>
  aNode('stop', {
    type: 'stopAndError',
    parameters: { message: { fixed: 'Refused' } },
    settings: defaultSettings({ retry: { attempts: 2, waitMs } }),
  });

describe('RunWorkflow on the engine', () => {
  let t: TestApp;
  let clock: ManualWorkflowClock;
  let owner: User;

  beforeAll(async () => {
    clock = new ManualWorkflowClock(Date.now());
    t = await createTestApp((builder) =>
      builder
        .overrideProvider(WORKFLOWS_MODULE_OPTIONS)
        .useValue({ worker: false, clock }),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    owner = await createUser(t, {
      email: 'editor@example.com',
      role: Role.Editor,
    });
  });

  const drain = () => t.app.get(WorkflowWorker).drain();

  const view = (run: Run) => t.app.get(RunQueries).get(run.id);

  const stored = async (nodes: NodeProps[], runTimeoutMs = 3_600_000) => {
    const workflow = Workflow.create({ name: 'Orders', ownerId: owner.id });
    workflow.saveDraft(
      1,
      aGraph(
        [aTrigger('start'), ...nodes],
        nodes.map((node, index) =>
          link(index === 0 ? 'start' : nodes[index - 1]!.id, node.id),
        ),
      ),
      { timezone: 'UTC', runTimeoutMs, errorWorkflowId: null },
    );
    await t.app.get(WorkflowRepository).add(workflow);
    return workflow;
  };

  const launch = (workflow: Workflow) =>
    t.app.get(TransactionHost).withTransaction(async () => {
      const run = await t.app.get(StartTestRun).execute({
        actor: owner,
        workflowId: workflow.id,
        revision: 2,
        triggerNodeId: 'start',
        items,
      });
      await t.app.get(RunLauncher).launch(run);
      return run;
    });

  it('a_run_walks_its_nodes_and_stores_every_output', async () => {
    const workflow = await stored([
      aNode('double', {
        type: 'editFields',
        parameters: {
          assignments: [
            {
              name: { fixed: 'total' },
              value: { formula: '{{ $json.price * 2 }}' },
            },
          ],
        },
      }),
      aNode('check', {
        type: 'if',
        parameters: {
          conditions: {
            rules: [
              {
                left: { ref: { node: '$item', path: 'total' } },
                operator: { fixed: 'number:gt' },
                right: { fixed: 30 },
              },
            ],
          },
        },
      }),
    ]);
    const run = await launch(workflow);
    await drain();
    const finished = await view(run);
    expect(finished.status).toBe(RunStatus.Succeeded);
    expect(finished.steps.map((step) => [step.nodeId, step.status])).toEqual([
      ['start', StepStatus.Succeeded],
      ['double', StepStatus.Succeeded],
      ['check', StepStatus.Succeeded],
    ]);
    const check = finished.steps.find((step) => step.nodeId === 'check')!;
    const artifacts = t.app.get(ArtifactStore);
    expect(
      await artifacts.readAll(
        check.outputs.filter((output) => output.port === 'true'),
      ),
    ).toEqual([{ name: 'litter', price: 25, total: 50 }]);
    expect(
      await artifacts.readAll(
        check.outputs.filter((output) => output.port === 'false'),
      ),
    ).toEqual([{ name: 'kibble', price: 10, total: 20 }]);
  });

  it('a_failed_attempt_waits_the_retry_delay_of_the_node_before_it_runs_again', async () => {
    const run = await launch(await stored([refusing(1_000)]));
    await drain();
    const waiting = await view(run);
    expect(waiting.status).toBe(RunStatus.Running);
    expect(waiting.steps.find((step) => step.nodeId === 'stop')?.status).toBe(
      StepStatus.Running,
    );
    clock.advance('1s');
    await drain();
    const failed = await view(run);
    expect(failed.status).toBe(RunStatus.Failed);
    expect(failed.steps.find((step) => step.nodeId === 'stop')).toMatchObject({
      status: StepStatus.Failed,
      attempts: 2,
    });
    expect(failed.error).toEqual({
      nodeId: 'stop',
      kind: ErrorKind.User,
      message: 'Refused',
    });
  });

  it('a_cancelled_run_stops_waiting_and_stays_cancelled', async () => {
    const run = await launch(await stored([refusing(60_000)]));
    await drain();
    const cancelled = await t.app
      .get(TransactionHost)
      .withTransaction(() =>
        t.app.get(CancelRun).execute({ actor: owner, runId: run.id }),
      );
    await t.app.get(RunLauncher).cancel(cancelled);
    await drain();
    const finished = await view(run);
    expect(finished.status).toBe(RunStatus.Cancelled);
    expect(finished.error?.kind).toBe(ErrorKind.Cancelled);
    expect(finished.steps.find((step) => step.nodeId === 'stop')).toMatchObject(
      { status: StepStatus.Failed, error: { kind: ErrorKind.Cancelled } },
    );
    expect((await t.app.get(WorkflowClient).getStatus(run.id))?.status).toBe(
      'cancelled',
    );
  });

  it('a_run_past_its_timeout_fails_as_timed_out', async () => {
    const run = await launch(await stored([refusing(60_000)], 2_000));
    await drain();
    clock.advance('3s');
    await drain();
    const finished = await view(run);
    expect(finished.status).toBe(RunStatus.Failed);
    expect(finished.error).toEqual({
      nodeId: null,
      kind: ErrorKind.Timeout,
      message: 'The run timed out',
    });
  });

  it('a_run_whose_timeout_passes_before_it_begins_ends_as_timed_out', async () => {
    const run = await launch(await stored([aNode('a')], 2_000));
    clock.advance('3s');
    await drain();
    clock.advance('61s');
    await t.app
      .get(WorkflowClient)
      .start(MaintenanceWorkflow, null, { id: `maintenance-${run.id}` });
    await drain();
    const finished = await view(run);
    expect(finished.status).toBe(RunStatus.Failed);
    expect(finished.error).toEqual({
      nodeId: null,
      kind: ErrorKind.Timeout,
      message: 'The run timed out',
    });
  });

  it('maintenance_ends_an_unfinished_run_whose_engine_instance_is_gone', async () => {
    const workflow = await stored([aNode('a')]);
    const orphan = workflow.startTestRun({
      runId: Run.newId(null),
      revision: 2,
      triggerNodeId: 'start',
      problems: [],
      input: [],
      pins: [],
    });
    await t.app.get(RunRepository).add(orphan);
    clock.advance('6m');
    await t.app
      .get(WorkflowClient)
      .start(MaintenanceWorkflow, null, { id: `maintenance-${orphan.id}` });
    await drain();
    const finished = await view(orphan);
    expect(finished.status).toBe(RunStatus.Failed);
    expect(finished.error).toEqual({
      nodeId: null,
      kind: ErrorKind.Platform,
      message: 'The run stopped without finishing',
    });
  });
});
