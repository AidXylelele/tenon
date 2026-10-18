import { TransactionHost } from '@nestjs-cls/transactional';
import { sql } from 'drizzle-orm';
import {
  ReleaseRepository,
  WorkflowRepository,
} from '../../../src/application/interfaces.js';
import { Role } from '../../../src/domain/enums.js';
import {
  ReleaseConflictError,
  ReleaseNotFoundError,
  WorkflowConflictError,
  WorkflowNotFoundError,
} from '../../../src/domain/errors.js';
import { Workflow } from '../../../src/domain/workflow.js';
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

describe('DrizzleWorkflowRepository and DrizzleReleaseRepository', () => {
  let t: TestApp;
  let workflows: WorkflowRepository;
  let releases: ReleaseRepository;
  let ownerId: string;

  beforeAll(async () => {
    t = await createTestApp();
    workflows = t.app.get(WorkflowRepository);
    releases = t.app.get(ReleaseRepository);
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

  const stored = async () => {
    const workflow = Workflow.create({ name: 'Orders', ownerId });
    workflow.saveDraft(
      1,
      aGraph(
        [
          aTrigger('start', { name: 'Start' }),
          aNode('a', {
            name: 'Tidy',
            parameters: {
              value: { formula: "{{ $('Start').first().json.id }}" },
            },
            settings: defaultSettings({ retry: { attempts: 3, waitMs: 500 } }),
            position: { x: 240, y: 80 },
          }),
        ],
        [link('start', 'a')],
      ),
      { timezone: 'Europe/Kyiv', runTimeoutMs: 120_000, errorWorkflowId: null },
    );
    workflow.pin('a');
    await workflows.add(workflow);
    return workflow;
  };

  it('a_workflow_is_read_back_with_its_draft_settings_and_pins', async () => {
    const workflow = await stored();
    const found = await workflows.getById(workflow.id);
    expect(found.name).toBe('Orders');
    expect(found.ownerId).toBe(ownerId);
    expect(found.revision).toBe(2);
    expect(found.settings).toEqual({
      timezone: 'Europe/Kyiv',
      runTimeoutMs: 120_000,
      errorWorkflowId: null,
    });
    expect(found.pinnedNodeIds).toEqual(['a']);
    expect(found.graph.nodes.map((node) => node.name)).toEqual([
      'Start',
      'Tidy',
    ]);
    expect(found.graph.node('a').parameters).toEqual({
      value: { formula: "{{ $('Start').first().json.id }}" },
    });
    expect(found.graph.node('a').settings.retry).toEqual({
      attempts: 3,
      waitMs: 500,
    });
    expect(found.graph.node('a').position).toEqual({ x: 240, y: 80 });
    expect(found.graph.node('start').isTrigger).toBe(true);
    expect(
      found.graph.connections.map((connection) => [
        connection.from.id,
        connection.to.id,
      ]),
    ).toEqual([['start', 'a']]);
  });

  it('an_unknown_workflow_is_not_found', async () => {
    await expect(
      workflows.getById('00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(WorkflowNotFoundError);
  });

  it('a_change_made_on_a_stale_copy_is_refused_with_a_conflict', async () => {
    const workflow = await stored();
    const first = await workflows.getById(workflow.id);
    const second = await workflows.getById(workflow.id);
    first.rename('Orders v2');
    await workflows.update(first);
    second.rename('Orders v3');
    await expect(workflows.update(second)).rejects.toBeInstanceOf(
      WorkflowConflictError,
    );
    expect((await workflows.getById(workflow.id)).name).toBe('Orders v2');
  });

  it('activating_a_release_queues_one_activation_message_with_the_change', async () => {
    const workflow = await stored();
    const release = workflow.publish(2, [], ownerId);
    await releases.add(release);
    workflow.activate(release, []);
    await t.app
      .get(TransactionHost)
      .withTransaction(() => workflows.update(workflow));
    const result = await t.db.execute(
      sql`select topic, key, payload from nest_outbox.messages`,
    );
    expect(result.rows).toEqual([
      {
        topic: 'automation.activation',
        key: workflow.id,
        payload: { workflowId: workflow.id },
      },
    ]);
    expect((await workflows.getById(workflow.id)).activeRelease).toBe(1);
  });

  it('a_release_keeps_the_graph_it_was_published_with', async () => {
    const workflow = await stored();
    const release = workflow.publish(2, [], ownerId);
    await releases.add(release);
    await workflows.update(workflow);
    const latest = await workflows.getById(workflow.id);
    latest.saveDraft(2, aGraph([aTrigger('start')]), latest.settings);
    await workflows.update(latest);
    const found = await releases.get(workflow.id, 1);
    expect(found.number).toBe(1);
    expect(found.publishedBy).toBe(ownerId);
    expect(found.graph.nodes.map((node) => node.id)).toEqual(['start', 'a']);
    expect(found.settings.timezone).toBe('Europe/Kyiv');
    expect((await workflows.getById(workflow.id)).latestRelease).toBe(1);
  });

  it('a_release_number_is_published_once_and_an_unknown_one_is_not_found', async () => {
    const workflow = await stored();
    const release = workflow.publish(2, [], ownerId);
    await releases.add(release);
    await expect(releases.add(release)).rejects.toBeInstanceOf(
      ReleaseConflictError,
    );
    await expect(releases.get(workflow.id, 7)).rejects.toBeInstanceOf(
      ReleaseNotFoundError,
    );
  });
});
