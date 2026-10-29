import request from 'supertest';
import { Role } from '../../../src/domain/identity/enums.js';
import { authHeaders, createUser, signIn } from '../../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';
import { DEFECTIVE_DOCUMENTS, yamlOf } from './fixtures/defective-documents.js';

const YAML = 'application/yaml';

function greeting(version: string, text: string): string {
  return `document:\n  dsl: '1.0.3'\n  namespace: default\n  name: greet\n  version: '${version}'\ndo:\n  - hello:\n      set:\n        greeting: ${text}\n`;
}

interface ProblemBody {
  readonly pointer: string;
  readonly message: string;
}

describe('publishing workflows', () => {
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

  it('a_valid_document_becomes_the_current_version_and_reads_back_as_submitted', async () => {
    const text = greeting('1.0.0', 'hello');

    const published = await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type(YAML)
      .send(text)
      .expect(201);
    const workflow = await request(t.server)
      .get('/api/v1/workflows/default/greet')
      .set(viewer)
      .expect(200);
    const document = await request(t.server)
      .get('/api/v1/workflows/default/greet/versions/1.0.0')
      .set(viewer)
      .expect(200);

    expect(published.body).toMatchObject({
      namespace: 'default',
      name: 'greet',
      version: '1.0.0',
      dsl: '1.0.3',
      current: true,
    });
    expect(workflow.body).toEqual({
      namespace: 'default',
      name: 'greet',
      on: false,
      currentVersion: '1.0.0',
    });
    expect(document.text).toBe(text);
    expect(document.headers['content-type']).toMatch(/^application\/yaml/);
  });

  it('a_document_in_json_is_accepted_and_kept_as_json', async () => {
    const json = JSON.stringify({
      document: {
        dsl: '1.0.3',
        namespace: 'default',
        name: 'greet',
        version: '1.0.0',
      },
      do: [{ hello: { set: { greeting: 'hi' } } }],
    });

    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type('application/json')
      .send(json)
      .expect(201);
    const document = await request(t.server)
      .get('/api/v1/workflows/default/greet/versions/1.0.0')
      .set(viewer)
      .expect(200);

    expect(document.text).toBe(json);
  });

  it('the_identical_document_again_returns_the_existing_version', async () => {
    const text = greeting('1.0.0', 'hello');
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type(YAML)
      .send(text)
      .expect(201);

    const again = await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type(YAML)
      .send(text)
      .expect(200);
    const versions = await request(t.server)
      .get('/api/v1/workflows/default/greet/versions')
      .set(viewer)
      .expect(200);

    expect(again.body).toMatchObject({ version: '1.0.0' });
    expect(versions.body).toHaveLength(1);
  });

  it('other_content_under_a_published_version_is_a_conflict', async () => {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type(YAML)
      .send(greeting('1.0.0', 'hello'))
      .expect(201);

    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type(YAML)
      .send(greeting('1.0.0', 'goodbye'))
      .expect(409);
  });

  it('a_later_version_becomes_current', async () => {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type(YAML)
      .send(greeting('1.0.0', 'hello'))
      .expect(201);
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type(YAML)
      .send(greeting('1.1.0', 'hi'))
      .expect(201);

    const workflow = await request(t.server)
      .get('/api/v1/workflows/default/greet')
      .set(viewer)
      .expect(200);
    const versions = await request(t.server)
      .get('/api/v1/workflows/default/greet/versions')
      .set(viewer)
      .expect(200);

    expect(workflow.body).toMatchObject({ currentVersion: '1.1.0' });
    const listed = versions.body as { version: string; current: boolean }[];
    const currency = listed.map((version) => [
      version.version,
      version.current,
    ]);

    expect(currency).toEqual([
      ['1.0.0', false],
      ['1.1.0', true],
    ]);
  });

  it('a_document_with_several_defects_is_refused_with_every_defect_and_nothing_is_stored', async () => {
    const text = `document:\n  dsl: '1.0.3'\n  namespace: default\n  name: broken\n  version: '1.0.0'\ndo:\n  - pause:\n      wait: PT1S\n  - compute:\n      set:\n        value: '\${ .a + }'\n      then: nowhere\n`;

    const refused = await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type(YAML)
      .send(text)
      .expect(422);
    const listed = await request(t.server)
      .get('/api/v1/workflows')
      .set(viewer)
      .expect(200);

    const pointers = (refused.body.problems as ProblemBody[]).map(
      (problem) => problem.pointer,
    );
    expect(pointers).toEqual([
      '/do/0/pause/wait',
      '/do/1/compute/then',
      '/do/1/compute/set/value',
    ]);
    expect(listed.body.items).toEqual([]);
  });

  it('checking_gives_the_report_publishing_would_give_and_stores_nothing', async () => {
    const text = `document:\n  dsl: '1.0.3'\n  namespace: default\n  name: broken\n  version: '1.0.0'\ndo:\n  - pause:\n      wait: PT1S\n`;

    const checked = await request(t.server)
      .post('/api/v1/workflows/check')
      .set(editor)
      .type(YAML)
      .send(text)
      .expect(200);
    const refused = await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type(YAML)
      .send(text)
      .expect(422);
    const listed = await request(t.server)
      .get('/api/v1/workflows')
      .set(viewer)
      .expect(200);

    expect(checked.body.valid).toBe(false);
    expect(checked.body.problems).toEqual(refused.body.problems);
    expect(listed.body.items).toEqual([]);
  });

  it('a_malformed_json_document_is_reported_as_a_problem_of_the_document', async () => {
    const checked = await request(t.server)
      .post('/api/v1/workflows/check')
      .set(editor)
      .type('application/json')
      .send('{ "document": ')
      .expect(200);

    expect(checked.body.valid).toBe(false);
    expect(checked.body.problems).toHaveLength(1);
  });

  it('a_path_that_is_not_a_workflow_name_is_refused', async () => {
    await request(t.server)
      .get('/api/v1/workflows/Bad_Namespace/greet')
      .set(viewer)
      .expect(400);
  });

  it('a_viewer_cannot_publish_or_check', async () => {
    const text = greeting('1.0.0', 'hello');

    await request(t.server)
      .post('/api/v1/workflows')
      .set(viewer)
      .type(YAML)
      .send(text)
      .expect(403);
    await request(t.server)
      .post('/api/v1/workflows/check')
      .set(viewer)
      .type(YAML)
      .send(text)
      .expect(403);
  });

  it('an_unsupported_media_type_is_refused', async () => {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type('text/plain')
      .send('do: []')
      .expect(415);
  });

  it('a_document_above_one_mebibyte_is_refused', async () => {
    const padding = '#'.repeat(1_100_000);
    const text = `${greeting('1.0.0', 'hello')}${padding}\n`;

    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type(YAML)
      .send(text)
      .expect(413);
  });

  it('the_conformance_statement_names_the_subset_and_the_recorded_contradiction', async () => {
    const statement = await request(t.server)
      .get('/api/v1/conformance')
      .set(viewer)
      .expect(200);

    expect(statement.body.dsl).toEqual(['1.0.0', '1.0.1', '1.0.2', '1.0.3']);
    expect(statement.body.runs).toEqual(['workflow', 'script', 'shell']);
    expect(statement.body.excluded).toContain('the wait task');
    expect(statement.body.contradictions).toHaveLength(1);
  });

  it.each(DEFECTIVE_DOCUMENTS.map((document) => [document.defect, document]))(
    'a_document_with_%s_is_refused_where_the_defect_is',
    async (_, document) => {
      const text = yamlOf(document);

      const refused = await request(t.server)
        .post('/api/v1/workflows')
        .set(editor)
        .type(YAML)
        .send(text)
        .expect(422);

      const pointers = (refused.body.problems as ProblemBody[]).map(
        (problem) => problem.pointer,
      );
      const located = pointers.some(
        (pointer) =>
          pointer === document.pointer ||
          pointer.startsWith(`${document.pointer}/`),
      );
      expect(located, `${document.defect}: ${pointers.join(', ')}`).toBe(true);
    },
  );
});
