import {
  NodeSamples,
  RunQueries,
  RunRepository,
  WorkflowQueries,
  WorkflowRepository,
} from '../../../src/application/interfaces.js';
import { Role, RunStatus } from '../../../src/domain/enums.js';
import { WorkflowNotFoundError } from '../../../src/domain/errors.js';
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

describe('Automation queries and node samples', () => {
  let t: TestApp;
  let workflows: WorkflowRepository;
  let queries: WorkflowQueries;
  let samples: NodeSamples;
  let runs: RunRepository;
  let runQueries: RunQueries;
  let ownerId: string;

  beforeAll(async () => {
    t = await createTestApp();
    workflows = t.app.get(WorkflowRepository);
    queries = t.app.get(WorkflowQueries);
    samples = t.app.get(NodeSamples);
    runs = t.app.get(RunRepository);
    runQueries = t.app.get(RunQueries);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    const owner = await createUser(t, {
      email: 'editor@example.com',
      name: 'Ed Editor',
      role: Role.Editor,
    });
    ownerId = owner.id;
  });

  const stored = async (name: string) => {
    const workflow = Workflow.create({ name, ownerId });
    workflow.saveDraft(
      1,
      aGraph([aTrigger('start'), aNode('a')], [link('start', 'a')]),
      workflow.settings,
    );
    await workflows.add(workflow);
    return workflow;
  };

  const filter = {
    search: null,
    ownerId: null,
    archived: false,
    cursor: null,
    limit: 50,
  };

  it('workflows_are_listed_newest_first_page_by_page', async () => {
    await stored('First');
    await stored('Second');
    await stored('Third');
    const first = await queries.list({ ...filter, limit: 2 });
    expect(first.items.map((item) => item.name)).toEqual(['Third', 'Second']);
    expect(first.items[0]?.owner).toEqual({ id: ownerId, name: 'Ed Editor' });
    const second = await queries.list({
      ...filter,
      limit: 2,
      cursor: first.nextCursor,
    });
    expect(second.items.map((item) => item.name)).toEqual(['First']);
    expect(second.nextCursor).toBeNull();
  });

  it('the_search_matches_names_literally_and_archived_workflows_are_listed_apart', async () => {
    await stored('Orders 100%');
    await stored('Orders 1000');
    const archived = await stored('Old orders');
    archived.archive();
    await workflows.update(archived);
    const found = await queries.list({ ...filter, search: '100%' });
    expect(found.items.map((item) => item.name)).toEqual(['Orders 100%']);
    const shelf = await queries.list({ ...filter, archived: true });
    expect(shelf.items.map((item) => item.name)).toEqual(['Old orders']);
    expect(shelf.items[0]?.archived).toBe(true);
  });

  it('a_workflow_view_carries_its_draft_and_the_samples_of_its_nodes', async () => {
    const workflow = await stored('Orders');
    await samples.pin(workflow.id, 'a', [{ id: 1, name: 'kibble' }]);
    await samples.recordFields(workflow.id, 'start', [
      { path: 'id', type: 'number' },
    ]);
    const view = await queries.get(workflow.id);
    expect(view.revision).toBe(2);
    expect(view.graph.nodes.map((node) => node.id)).toEqual(['start', 'a']);
    expect(view.samples).toEqual(
      expect.arrayContaining([
        {
          nodeId: 'a',
          pinned: true,
          fields: [
            { path: 'id', type: 'number' },
            { path: 'name', type: 'string' },
          ],
        },
        {
          nodeId: 'start',
          pinned: false,
          fields: [{ path: 'id', type: 'number' }],
        },
      ]),
    );
    await expect(
      queries.get('00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(WorkflowNotFoundError);
  });

  it('fields_from_a_run_never_replace_the_fields_of_a_pin_and_unpinning_forgets_the_pin', async () => {
    const workflow = await stored('Orders');
    await samples.pin(workflow.id, 'a', [{ pinned: true }]);
    await samples.recordFields(workflow.id, 'a', [
      { path: 'other', type: 'string' },
    ]);
    expect(await samples.pinned(workflow.id, 'a')).toEqual([{ pinned: true }]);
    const pinned = await queries.get(workflow.id);
    expect(pinned.samples).toEqual([
      {
        nodeId: 'a',
        pinned: true,
        fields: [{ path: 'pinned', type: 'boolean' }],
      },
    ]);
    await samples.unpin(workflow.id, 'a');
    expect(await samples.pinned(workflow.id, 'a')).toEqual([]);
    await samples.recordFields(workflow.id, 'a', [
      { path: 'other', type: 'string' },
    ]);
    const recorded = await queries.get(workflow.id);
    expect(recorded.samples).toEqual([
      {
        nodeId: 'a',
        pinned: false,
        fields: [{ path: 'other', type: 'string' }],
      },
    ]);
  });

  it('runs_are_listed_newest_first_with_their_steps_and_old_unfinished_runs_are_found', async () => {
    const workflow = await stored('Orders');
    const start = () =>
      workflow.startTestRun({
        runId: Run.newId(null),
        revision: 2,
        triggerNodeId: 'start',
        problems: [],
        input: [],
        pins: [],
      });
    const older = start();
    await runs.add(older);
    const newer = start();
    await runs.add(newer);
    const begun = await runs.getById(newer.id);
    begun.begin();
    begun.reach('start');
    begun.cancel();
    await runs.update(begun);
    const page = await runQueries.list(workflow.id, {
      status: null,
      cursor: null,
      limit: 1,
    });
    expect(page.items.map((item) => item.id)).toEqual([newer.id]);
    const rest = await runQueries.list(workflow.id, {
      status: null,
      cursor: page.nextCursor,
      limit: 1,
    });
    expect(rest.items.map((item) => item.id)).toEqual([older.id]);
    const cancelled = await runQueries.list(workflow.id, {
      status: RunStatus.Cancelled,
      cursor: null,
      limit: 10,
    });
    expect(cancelled.items.map((item) => item.id)).toEqual([newer.id]);
    const view = await runQueries.get(newer.id);
    expect(view.status).toBe(RunStatus.Cancelled);
    expect(view.steps.map((step) => step.nodeId)).toEqual(['start']);
    expect(
      await runQueries.unfinishedBefore(new Date(Date.now() + 60_000), 10),
    ).toEqual([older.id]);
    expect(
      await runQueries.unfinishedBefore(new Date(Date.now() - 60_000), 10),
    ).toEqual([]);
  });
});
