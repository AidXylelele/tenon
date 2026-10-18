import {
  ReleaseRepository,
  RunRepository,
  WorkflowRepository,
} from '../../../src/application/interfaces.js';
import {
  ErrorKind,
  Role,
  RunMode,
  RunStatus,
  StepStatus,
} from '../../../src/domain/enums.js';
import {
  RunConflictError,
  RunNotFoundError,
} from '../../../src/domain/errors.js';
import type { StepOutput } from '../../../src/domain/interfaces.js';
import { Run } from '../../../src/domain/run.js';
import { Workflow } from '../../../src/domain/workflow.js';
import { createUser } from '../../support/auth-helpers.js';
import {
  aGraph,
  aNode,
  aTrigger,
  link,
} from '../../support/automation-builders.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';

const input: StepOutput = {
  port: 'main',
  items: 2,
  bytes: 24,
  key: 'runs/r/nodes/start/a0/main',
  chunkStarts: [0],
};

describe('DrizzleRunRepository', () => {
  let t: TestApp;
  let workflows: WorkflowRepository;
  let releases: ReleaseRepository;
  let runs: RunRepository;
  let ownerId: string;

  beforeAll(async () => {
    t = await createTestApp();
    workflows = t.app.get(WorkflowRepository);
    releases = t.app.get(ReleaseRepository);
    runs = t.app.get(RunRepository);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    const owner = await createUser(t, {
      email: 'editor@example.com',
      role: Role.Editor,
    });
    ownerId = owner.id;
  });

  const workflow = async () => {
    const created = Workflow.create({ name: 'Orders', ownerId });
    created.saveDraft(
      1,
      aGraph(
        [aTrigger('start'), aNode('a'), aNode('b')],
        [link('start', 'a'), link('a', 'b')],
      ),
      { timezone: 'Europe/Kyiv', runTimeoutMs: 60_000, errorWorkflowId: null },
    );
    await workflows.add(created);
    return created;
  };

  const testRun = async () => {
    const owner = await workflow();
    const run = owner.startTestRun({
      runId: Run.newId(null),
      revision: 2,
      triggerNodeId: 'start',
      problems: [],
      input: [input],
      pins: [],
    });
    await runs.add(run);
    return run;
  };

  it('a_test_run_is_read_back_with_its_graph_snapshot_input_and_steps', async () => {
    const run = await testRun();
    const begun = await runs.getById(run.id);
    begun.begin();
    begun.reach('start');
    begun.reach('a');
    await runs.update(begun);
    const found = await runs.getById(run.id);
    expect(found.mode).toBe(RunMode.Test);
    expect(found.status).toBe(RunStatus.Running);
    expect(found.timezone).toBe('Europe/Kyiv');
    expect(found.timeoutMs).toBe(60_000);
    expect(found.input).toEqual([input]);
    expect(found.order.map((node) => node.id)).toEqual(['start', 'a', 'b']);
    expect(found.step('start')?.status).toBe(StepStatus.Succeeded);
    expect(found.step('start')?.outputs).toEqual([input]);
    expect(found.step('a')?.status).toBe(StepStatus.Running);
    expect(found.step('b')).toBeUndefined();
  });

  it('a_step_finished_in_a_later_update_is_stored_with_its_outputs_and_error', async () => {
    const run = await testRun();
    const begun = await runs.getById(run.id);
    begun.begin();
    begun.reach('start');
    begun.reach('a');
    await runs.update(begun);
    const reached = await runs.getById(run.id);
    reached.fail(
      'a',
      2,
      {
        kind: ErrorKind.User,
        message: 'price: expected a number',
        parameter: 'price',
        item: 1,
        typeUnavailable: false,
      },
      [],
    );
    await runs.update(reached);
    const found = await runs.getById(run.id);
    expect(found.status).toBe(RunStatus.Failed);
    expect(found.step('a')?.status).toBe(StepStatus.Failed);
    expect(found.step('a')?.attempts).toBe(2);
    expect(found.step('a')?.error).toMatchObject({
      kind: ErrorKind.User,
      parameter: 'price',
      item: 1,
    });
    expect(found.error).toEqual({
      nodeId: 'a',
      kind: ErrorKind.User,
      message: 'price: expected a number',
    });
  });

  it('a_production_run_reads_its_graph_from_its_release', async () => {
    const owner = await workflow();
    const release = owner.publish(2, [], ownerId);
    await releases.add(release);
    await workflows.update(owner);
    const run = owner.startManualRun(release, {
      runId: Run.newId(null),
      triggerNodeId: 'start',
      input: [input],
    });
    await runs.add(run);
    const found = await runs.getById(run.id);
    expect(found.mode).toBe(RunMode.Production);
    expect(found.releaseNumber).toBe(1);
    expect(found.order.map((node) => node.id)).toEqual(['start', 'a', 'b']);
  });

  it('a_change_made_on_a_stale_copy_is_refused_with_a_conflict', async () => {
    const run = await testRun();
    const first = await runs.getById(run.id);
    const second = await runs.getById(run.id);
    first.cancel();
    await runs.update(first);
    second.begin();
    await expect(runs.update(second)).rejects.toBeInstanceOf(RunConflictError);
    expect((await runs.getById(run.id)).status).toBe(RunStatus.Cancelled);
  });

  it('a_run_id_is_used_once_and_an_unknown_run_is_not_found', async () => {
    const run = await testRun();
    await expect(runs.add(run)).rejects.toBeInstanceOf(RunConflictError);
    await expect(
      runs.getById('00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(RunNotFoundError);
  });
});
