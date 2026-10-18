import { randomUUID } from 'node:crypto';
import {
  ManualWorkflowClock,
  WORKFLOWS_MODULE_OPTIONS,
  WorkflowWorker,
} from '@nestjs/workflows';
import request from 'supertest';
import { Role } from '../../src/domain/enums.js';
import { authHeaders, createUser, signIn } from '../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../support/create-test-app.js';
import { truncateAll } from '../support/db.js';

const START = randomUUID();
const DOUBLE = randomUUID();
const CHECK = randomUUID();

const trigger = (id = START, name = 'Start') => ({
  id,
  name,
  type: 'manualTrigger',
  typeVersion: 1,
  position: [0, 0],
});

const double = {
  id: DOUBLE,
  name: 'Double',
  type: 'editFields',
  typeVersion: 1,
  parameters: {
    assignments: [
      {
        name: { fixed: 'total' },
        value: { formula: '{{ $json.price * 2 }}' },
      },
    ],
  },
  position: [200, 0],
};

const check = (operator = 'number:gt') => ({
  id: CHECK,
  name: 'Check',
  type: 'if',
  typeVersion: 1,
  parameters: {
    conditions: {
      rules: [
        {
          left: { ref: { node: '$item', path: 'total' } },
          operator: { fixed: operator },
          right: { fixed: 30 },
        },
      ],
    },
  },
  position: [400, 0],
});

const connect = (from: string, to: string, output = 'main') => ({
  from: { node: from, output },
  to: { node: to, input: 'main' },
});

const graph = (operator?: string) => ({
  nodes: [trigger(), double, check(operator)],
  connections: [connect(START, DOUBLE), connect(DOUBLE, CHECK)],
});

const items = [
  { name: 'kibble', price: 10 },
  { name: 'litter', price: 25 },
];

describe('workflows, releases and runs over HTTP', () => {
  let t: TestApp;
  let editor: string;
  let other: string;
  let viewer: string;
  let otherId: string;

  beforeAll(async () => {
    t = await createTestApp((builder) =>
      builder.overrideProvider(WORKFLOWS_MODULE_OPTIONS).useValue({
        worker: false,
        clock: new ManualWorkflowClock(Date.now()),
      }),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    await createUser(t, {
      email: 'editor@example.com',
      name: 'Ed Editor',
      role: Role.Editor,
    });
    const second = await createUser(t, {
      email: 'other@example.com',
      name: 'Otto Other',
      role: Role.Editor,
    });
    otherId = second.id;
    await createUser(t, { email: 'viewer@example.com', role: Role.Viewer });
    editor = await signIn(t.server, 'editor@example.com');
    other = await signIn(t.server, 'other@example.com');
    viewer = await signIn(t.server, 'viewer@example.com');
  });

  const api = (cookie: string) => ({
    get: (path: string) =>
      request(t.server).get(`/api/v1${path}`).set(authHeaders(cookie)),
    post: (path: string, body?: object) =>
      request(t.server)
        .post(`/api/v1${path}`)
        .set(authHeaders(cookie))
        .send(body),
    put: (path: string, body: object) =>
      request(t.server)
        .put(`/api/v1${path}`)
        .set(authHeaders(cookie))
        .send(body),
    patch: (path: string, body: object) =>
      request(t.server)
        .patch(`/api/v1${path}`)
        .set(authHeaders(cookie))
        .send(body),
    delete: (path: string) =>
      request(t.server).delete(`/api/v1${path}`).set(authHeaders(cookie)),
  });

  const created = async () => {
    const response = await api(editor)
      .post('/workflows', { name: 'Orders' })
      .expect(201);
    return response.body.id as string;
  };

  const saved = async (operator?: string) => {
    const id = await created();
    await api(editor)
      .put(`/workflows/${id}/draft`, {
        revision: 1,
        graph: graph(operator),
        settings: {},
      })
      .expect(200);
    return id;
  };

  const drain = () => t.app.get(WorkflowWorker).drain();

  it('an_editor_creates_a_workflow_it_owns_and_a_viewer_may_not', async () => {
    const response = await api(editor)
      .post('/workflows', { name: '  Orders  ' })
      .expect(201);
    expect(response.body).toMatchObject({
      name: 'Orders',
      owner: { name: 'Ed Editor' },
      archived: false,
      latestRelease: 0,
      activeRelease: null,
      canManage: true,
      draft: {
        revision: 1,
        graph: { nodes: [], connections: [] },
        settings: {
          timezone: 'UTC',
          runTimeoutMs: 3_600_000,
          errorWorkflowId: null,
        },
        problems: [],
      },
      samples: [],
    });
    await api(viewer).post('/workflows', { name: 'Mine' }).expect(403);
  });

  it('the_draft_is_saved_at_its_revision_and_a_stale_revision_conflicts', async () => {
    const id = await created();
    const response = await api(editor)
      .put(`/workflows/${id}/draft`, {
        revision: 1,
        graph: graph(),
        settings: { timezone: 'Europe/Kyiv' },
      })
      .expect(200);
    expect(response.body).toEqual({ revision: 2, problems: [] });
    await api(editor)
      .put(`/workflows/${id}/draft`, {
        revision: 1,
        graph: graph(),
        settings: {},
      })
      .expect(409);
    const opened = await api(viewer).get(`/workflows/${id}`).expect(200);
    expect(opened.body.canManage).toBe(false);
    expect(opened.body.draft.settings.timezone).toBe('Europe/Kyiv');
    expect(opened.body.draft.graph.nodes[0]).toMatchObject({
      id: START,
      trigger: 'manual',
      position: [0, 0],
      settings: { retry: { attempts: 1, waitMs: 0 }, onError: 'stop' },
    });
    expect(opened.body.draft.graph.connections).toEqual([
      connect(START, DOUBLE),
      connect(DOUBLE, CHECK),
    ]);
  });

  it('renaming_a_node_rewrites_the_formulas_that_name_it', async () => {
    const id = await created();
    const reader = {
      ...double,
      parameters: {
        assignments: [
          {
            name: { fixed: 'first' },
            value: { formula: "{{ $('Start').first().json.name }}" },
          },
        ],
      },
    };
    const draft = (name: string, revision: number) =>
      api(editor)
        .put(`/workflows/${id}/draft`, {
          revision,
          graph: {
            nodes: [trigger(START, name), reader],
            connections: [connect(START, DOUBLE)],
          },
          settings: {},
        })
        .expect(200);
    await draft('Start', 1);
    await draft('Begin', 2);
    const opened = await api(editor).get(`/workflows/${id}`).expect(200);
    expect(opened.body.draft.graph.nodes[1].parameters).toEqual({
      assignments: [
        {
          name: { fixed: 'first' },
          value: { formula: "{{ $('Begin').first().json.name }}" },
        },
      ],
    });
  });

  it('only_the_owner_changes_the_draft', async () => {
    const id = await created();
    const response = await api(other)
      .put(`/workflows/${id}/draft`, {
        revision: 1,
        graph: graph(),
        settings: {},
      })
      .expect(403);
    expect(response.body.statusCode).toBe(403);
  });

  it('a_malformed_graph_is_refused_with_every_fault', async () => {
    const id = await created();
    const response = await api(editor)
      .put(`/workflows/${id}/draft`, {
        revision: 1,
        graph: {
          nodes: [trigger(), double, { ...trigger(randomUUID(), 'Double') }],
          connections: [connect(START, DOUBLE), connect(DOUBLE, START)],
        },
        settings: {},
      })
      .expect(422);
    expect(
      (response.body.faults as { code: string }[])
        .map((fault) => fault.code)
        .sort(),
    ).toEqual(['cycle', 'duplicate-node-name']);
  });

  it('the_request_shape_and_its_limits_are_checked_before_anything_else', async () => {
    const id = await created();
    await api(editor)
      .put(`/workflows/${id}/draft`, {
        revision: 1,
        graph: { nodes: [{ ...trigger(), id: 'start' }], connections: [] },
        settings: {},
      })
      .expect(400);
    const deep: Record<string, unknown> = {};
    let cursor = deep;

    for (let level = 0; level < 70; level++) {
      const next: Record<string, unknown> = {};
      cursor['next'] = next;
      cursor = next;
    }

    await api(editor)
      .put(`/workflows/${id}/samples/${START}`, { items: [deep] })
      .expect(400);
    await api(editor)
      .put(`/workflows/${id}/samples/${START}`, {
        items: Array.from({ length: 101 }, () => ({})),
      })
      .expect(400);
    await api(editor)
      .put(`/workflows/${id}/draft`, {
        revision: 1,
        graph: graph(),
        settings: { timezone: 'Mars/Olympus' },
      })
      .expect(400);
  });

  it('configuration_problems_are_reported_on_save_and_block_publishing_and_test_runs', async () => {
    const id = await saved('number:bogus');
    const opened = await api(editor).get(`/workflows/${id}`).expect(200);
    expect(opened.body.draft.problems).toEqual([
      expect.objectContaining({ nodeId: CHECK, code: 'invalid-parameter' }),
    ]);
    const refused = await api(editor)
      .post(`/workflows/${id}/releases`, { revision: 2 })
      .expect(422);
    expect(refused.body.problems).toEqual([
      expect.objectContaining({ nodeId: CHECK, code: 'invalid-parameter' }),
    ]);
    await api(editor)
      .post('/runs', {
        workflowId: id,
        target: { draft: { revision: 2 } },
        triggerNodeId: START,
        items,
      })
      .expect(422);
  });

  it('a_test_run_walks_the_draft_and_its_step_output_is_read_page_by_page', async () => {
    const id = await saved();
    const queued = await api(editor)
      .post('/runs', {
        workflowId: id,
        target: { draft: { revision: 2 } },
        triggerNodeId: START,
        items,
      })
      .expect(202);
    const runId = queued.body.runId as string;
    await drain();
    const run = await api(viewer).get(`/runs/${runId}`).expect(200);
    expect(run.headers['cache-control']).toBe('no-cache');
    expect(run.body).toMatchObject({
      id: runId,
      workflowId: id,
      status: 'succeeded',
      mode: 'test',
      trigger: 'manual',
      release: null,
    });
    expect(
      (run.body.steps as { nodeId: string }[]).map((step) => step.nodeId),
    ).toEqual([START, DOUBLE, CHECK]);
    const etag = run.headers['etag'] as string;
    await api(viewer)
      .get(`/runs/${runId}`)
      .set('If-None-Match', etag)
      .expect(304);
    const page = await api(viewer)
      .get(`/runs/${runId}/steps/${CHECK}/output?port=true&limit=1`)
      .expect(200);
    expect(page.body).toEqual({
      items: [{ name: 'litter', price: 25, total: 50 }],
      total: 1,
      offset: 0,
    });
    const opened = await api(editor).get(`/workflows/${id}`).expect(200);
    expect(opened.body.samples).toEqual(
      expect.arrayContaining([
        {
          nodeId: DOUBLE,
          pinned: false,
          fields: [
            { path: 'name', type: 'string' },
            { path: 'price', type: 'number' },
            { path: 'total', type: 'number' },
          ],
        },
      ]),
    );
    const runs = await api(viewer).get(`/workflows/${id}/runs`).expect(200);
    expect(
      (runs.body.items as { id: string }[]).map((item) => item.id),
    ).toEqual([runId]);
  });

  it('a_pinned_sample_stands_in_for_its_node_in_test_runs', async () => {
    const id = await saved();
    const pinned = await api(editor)
      .put(`/workflows/${id}/samples/${DOUBLE}`, {
        items: [{ total: 99 }],
      })
      .expect(200);
    expect(pinned.body).toEqual({
      nodeId: DOUBLE,
      pinned: true,
      fields: [{ path: 'total', type: 'number' }],
    });
    const queued = await api(editor)
      .post('/runs', {
        workflowId: id,
        target: { draft: { revision: 2 } },
        triggerNodeId: START,
        items,
      })
      .expect(202);
    await drain();
    const page = await api(editor)
      .get(`/runs/${queued.body.runId}/steps/${CHECK}/output?port=true`)
      .expect(200);
    expect(page.body.items).toEqual([{ total: 99 }]);
    await api(editor).delete(`/workflows/${id}/samples/${DOUBLE}`).expect(204);
  });

  it('a_published_release_is_listed_read_and_run_by_hand', async () => {
    const id = await saved();
    const published = await api(editor)
      .post(`/workflows/${id}/releases`, { revision: 2 })
      .expect(201);
    expect(published.body).toMatchObject({
      number: 1,
      publishedBy: { name: 'Ed Editor' },
    });
    const list = await api(viewer).get(`/workflows/${id}/releases`).expect(200);
    expect(
      (list.body.items as { number: number }[]).map((item) => item.number),
    ).toEqual([1]);
    const release = await api(viewer)
      .get(`/workflows/${id}/releases/1`)
      .expect(200);
    expect(release.body.graph.nodes).toHaveLength(3);
    await api(viewer).get(`/workflows/${id}/releases/2`).expect(404);
    const queued = await api(editor)
      .post('/runs', {
        workflowId: id,
        target: { release: 1 },
        triggerNodeId: START,
        items,
      })
      .expect(202);
    await drain();
    const run = await api(editor).get(`/runs/${queued.body.runId}`).expect(200);
    expect(run.body).toMatchObject({
      status: 'succeeded',
      mode: 'production',
      release: 1,
    });
    await api(editor)
      .post('/runs', {
        workflowId: id,
        target: { release: 1, draft: { revision: 2 } },
        triggerNodeId: START,
      })
      .expect(400);
  });

  it('the_owner_cancels_a_waiting_run_once', async () => {
    const id = await created();
    const stop = {
      id: randomUUID(),
      name: 'Stop',
      type: 'stopAndError',
      typeVersion: 1,
      parameters: { message: { fixed: 'Refused' } },
      settings: { retry: { attempts: 5, waitMs: 300_000 } },
      position: [200, 0],
    };
    await api(editor)
      .put(`/workflows/${id}/draft`, {
        revision: 1,
        graph: {
          nodes: [trigger(), stop],
          connections: [connect(START, stop.id)],
        },
        settings: {},
      })
      .expect(200);
    const queued = await api(editor)
      .post('/runs', {
        workflowId: id,
        target: { draft: { revision: 2 } },
        triggerNodeId: START,
      })
      .expect(202);
    const runId = queued.body.runId as string;
    await drain();
    await api(other).post(`/runs/${runId}/cancel`).expect(403);
    await api(editor).post(`/runs/${runId}/cancel`).expect(202);
    await drain();
    const run = await api(editor).get(`/runs/${runId}`).expect(200);
    expect(run.body.status).toBe('cancelled');
    expect(run.body.error).toMatchObject({ kind: 'cancelled' });
    await api(editor).post(`/runs/${runId}/cancel`).expect(409);
  });

  it('an_archived_workflow_does_not_run_until_it_is_restored', async () => {
    const id = await saved();
    await api(editor).post(`/workflows/${id}/archive`).expect(204);
    await api(editor).post(`/workflows/${id}/archive`).expect(409);
    const shelf = await api(viewer).get('/workflows?archived=true').expect(200);
    expect(
      (shelf.body.items as { id: string }[]).map((item) => item.id),
    ).toEqual([id]);
    await api(editor)
      .post('/runs', {
        workflowId: id,
        target: { draft: { revision: 2 } },
        triggerNodeId: START,
      })
      .expect(409);
    await api(editor).post(`/workflows/${id}/restore`).expect(204);
    await api(editor)
      .post('/runs', {
        workflowId: id,
        target: { draft: { revision: 2 } },
        triggerNodeId: START,
      })
      .expect(202);
  });

  it('a_copy_belongs_to_the_copier_and_ownership_moves_only_to_an_editor', async () => {
    const id = await saved();
    const copy = await api(other)
      .post(`/workflows/${id}/duplicate`)
      .expect(201);
    expect(copy.body).toMatchObject({
      name: 'Orders (copy)',
      owner: { id: otherId, name: 'Otto Other' },
      canManage: true,
    });
    expect(copy.body.draft.graph.nodes).toHaveLength(3);
    const viewerId = (await api(viewer).get('/auth/session').expect(200)).body
      .user.id as string;
    await api(editor)
      .post(`/workflows/${id}/transfer`, { ownerId: viewerId })
      .expect(422);
    const moved = await api(editor)
      .post(`/workflows/${id}/transfer`, { ownerId: otherId })
      .expect(200);
    expect(moved.body).toMatchObject({
      owner: { id: otherId },
      canManage: false,
    });
  });

  it('renaming_answers_with_the_summary_and_the_list_searches_names', async () => {
    const id = await created();
    const renamed = await api(editor)
      .patch(`/workflows/${id}`, { name: 'Invoices' })
      .expect(200);
    expect(renamed.body).toMatchObject({ id, name: 'Invoices' });
    const found = await api(viewer).get('/workflows?search=voice').expect(200);
    expect(
      (found.body.items as { id: string }[]).map((item) => item.id),
    ).toEqual([id]);
    await api(viewer).get('/workflows?limit=500').expect(400);
  });

  it('the_catalogue_lists_every_core_node_type_with_its_parameter_schema', async () => {
    const response = await api(viewer).get('/node-types').expect(200);
    const nodeTypes = response.body.nodeTypes as {
      id: string;
      inputs: string[];
      parameters: { type: string };
    }[];
    const ids = nodeTypes.map((type) => type.id);
    expect(ids).toEqual(
      expect.arrayContaining(['manualTrigger', 'editFields', 'if', 'merge']),
    );
    const merge = nodeTypes.find((type) => type.id === 'merge')!;
    expect(merge.inputs).toEqual(['input1', 'input2', 'input3', 'input4']);
    expect(merge.parameters.type).toBe('object');
    expect(response.body.credentialTypes).toEqual([]);
  });
});
