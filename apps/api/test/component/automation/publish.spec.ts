import request from 'supertest';
import { Role } from '../../../src/domain/identity/enums.js';
import { authHeaders, createUser, signIn } from '../../support/auth-helpers.js';
import { aDocument } from '../../support/builders.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';

const PROBLEM = 'application/problem+json';

describe('publishing workflow definitions over HTTP', () => {
  let t: TestApp;
  let editor: Record<string, string>;
  let viewer: Record<string, string>;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    await createUser(t, { email: 'editor@example.com', role: Role.Editor });
    await createUser(t, { email: 'viewer@example.com', role: Role.Viewer });
    editor = authHeaders(await signIn(t.server, 'editor@example.com'));
    viewer = authHeaders(await signIn(t.server, 'viewer@example.com'));
  });

  it('a_valid_document_becomes_the_current_version_and_reads_back_as_the_same_json', async () => {
    const document = aDocument();

    const published = await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .send(document)
      .expect(201);
    const workflow = await request(t.server)
      .get('/api/v1/workflows/sales/route-lead')
      .set(viewer)
      .expect(200);
    const stored = await request(t.server)
      .get('/api/v1/workflows/sales/route-lead/versions/1.0.0')
      .set(viewer)
      .expect(200);

    expect(published.headers.location).toBe(
      '/api/v1/workflows/sales/route-lead/versions/1.0.0',
    );
    expect(published.body).toMatchObject({
      namespace: 'sales',
      name: 'route-lead',
      version: '1.0.0',
      dsl: '1.0.3',
      current: true,
    });
    expect(workflow.body).toEqual({
      namespace: 'sales',
      name: 'route-lead',
      status: 'active',
      on: false,
      currentVersion: '1.0.0',
    });
    expect(stored.body).toEqual(document);
  });

  it('the_same_document_again_answers_200_with_the_published_version', async () => {
    const first = await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .send(aDocument())
      .expect(201);
    const reordered = { do: aDocument().do, document: aDocument().document };

    const again = await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .send(reordered)
      .expect(200);

    expect(again.body).toEqual(first.body);
  });

  it('other_content_under_a_published_identity_is_a_conflict', async () => {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .send(aDocument())
      .expect(201);
    const changed = aDocument({}, [{ other: { set: { x: 1 } } }]);

    const conflict = await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .send(changed)
      .expect(409);

    expect(conflict.headers['content-type']).toContain(PROBLEM);
    expect(conflict.body).toMatchObject({
      type: 'urn:problem:workflow.version-taken',
      status: 409,
    });
  });

  it('an_invalid_document_answers_a_located_problem_and_stores_nothing', async () => {
    const document = aDocument({}, [{ greet: { set: { x: 1 }, thn: 'end' } }]);

    const refused = await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .send(document)
      .expect(422);
    await request(t.server)
      .get('/api/v1/workflows/sales/route-lead')
      .set(viewer)
      .expect(404);

    expect(refused.headers['content-type']).toContain(PROBLEM);
    expect(refused.body).toEqual({
      type: 'urn:problem:definition.invalid',
      title: 'The workflow definition is invalid',
      status: 422,
      detail: "'thn' is not a property here",
      errors: [
        { pointer: '/do/0/greet/thn', detail: "'thn' is not a property here" },
      ],
    });
  });

  it('checking_answers_as_publishing_would_and_stores_nothing', async () => {
    await request(t.server)
      .post('/api/v1/workflows/check')
      .set(editor)
      .send(aDocument())
      .expect(204);
    await request(t.server)
      .get('/api/v1/workflows/sales/route-lead')
      .set(viewer)
      .expect(404);
    const invalid = aDocument({ dsl: '0.9.0' });

    await request(t.server)
      .post('/api/v1/workflows/check')
      .set(editor)
      .send(invalid)
      .expect(422);
  });

  it('a_body_that_is_not_json_is_refused_as_an_unsupported_media_type', async () => {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type('application/yaml')
      .send('document:\n  dsl: 1.0.3\n')
      .expect(415);
  });

  it('a_body_that_is_not_a_json_object_is_a_bad_request', async () => {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .send([1, 2, 3])
      .expect(400);
  });

  it('an_archived_workflow_takes_no_new_version_and_lists_as_archived', async () => {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .send(aDocument())
      .expect(201);

    await request(t.server)
      .post('/api/v1/workflows/sales/route-lead/archive')
      .set(editor)
      .expect(204);
    await request(t.server)
      .post('/api/v1/workflows/sales/route-lead/archive')
      .set(editor)
      .expect(204);
    const refused = await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .send(aDocument({ version: '2.0.0' }))
      .expect(409);
    const archived = await request(t.server)
      .get('/api/v1/workflows?status=archived')
      .set(viewer)
      .expect(200);
    const active = await request(t.server)
      .get('/api/v1/workflows?status=active')
      .set(viewer)
      .expect(200);

    expect(refused.body).toMatchObject({
      type: 'urn:problem:workflow.archived',
    });
    expect(archived.body.items).toEqual([
      {
        namespace: 'sales',
        name: 'route-lead',
        status: 'archived',
        on: false,
        currentVersion: '1.0.0',
      },
    ]);
    expect(active.body.items).toEqual([]);
  });

  it('archiving_an_unknown_workflow_is_not_found', async () => {
    const missing = await request(t.server)
      .post('/api/v1/workflows/sales/missing/archive')
      .set(editor)
      .expect(404);

    expect(missing.body).toMatchObject({
      type: 'urn:problem:workflow.not-found',
    });
  });

  it('versions_list_in_publishing_order_and_an_unknown_workflow_has_none', async () => {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .send(aDocument())
      .expect(201);
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .send(aDocument({ version: '1.1.0' }))
      .expect(201);

    const versions = await request(t.server)
      .get('/api/v1/workflows/sales/route-lead/versions')
      .set(viewer)
      .expect(200);
    await request(t.server)
      .get('/api/v1/workflows/sales/missing/versions')
      .set(viewer)
      .expect(404);

    expect(versions.body).toMatchObject([
      { version: '1.0.0', current: false },
      { version: '1.1.0', current: true },
    ]);
  });

  it('the_workflow_list_pages_by_namespace_and_name', async () => {
    for (const name of ['alpha', 'beta', 'gamma']) {
      const document = aDocument({ name });
      await request(t.server)
        .post('/api/v1/workflows')
        .set(editor)
        .send(document)
        .expect(201);
    }

    const first = await request(t.server)
      .get('/api/v1/workflows?limit=2')
      .set(viewer)
      .expect(200);
    const second = await request(t.server)
      .get(`/api/v1/workflows?limit=2&cursor=${first.body.next as string}`)
      .set(viewer)
      .expect(200);

    const names = (body: { items: { name: string }[] }) =>
      body.items.map((item) => item.name);
    expect(names(first.body)).toEqual(['alpha', 'beta']);
    expect(names(second.body)).toEqual(['gamma']);
    expect(second.body.next).toBeNull();
  });

  it('a_viewer_reads_but_neither_publishes_nor_archives', async () => {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(viewer)
      .send(aDocument())
      .expect(403);
    await request(t.server)
      .post('/api/v1/workflows/sales/route-lead/archive')
      .set(viewer)
      .expect(403);
    await request(t.server).get('/api/v1/workflows').set(viewer).expect(200);
  });

  it('without_a_session_nothing_is_answered', async () => {
    await request(t.server).get('/api/v1/workflows').expect(401);
    await request(t.server)
      .post('/api/v1/workflows')
      .send(aDocument())
      .expect(401);
  });
});
