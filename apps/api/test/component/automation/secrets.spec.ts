import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { JsonObject } from '../../../src/domain/automation/json.js';
import { Role } from '../../../src/domain/identity/enums.js';
import { authHeaders, createUser, signIn } from '../../support/auth-helpers.js';
import { aDocument } from '../../support/builders.js';
import type { TestApp } from '../../support/create-test-app.js';
import {
  createRunApp,
  drain,
  instanceOf,
  publish,
  type RunApp,
  resetRuns,
  start,
  tasksOf,
} from '../../support/run-helpers.js';

const PROBLEM = 'application/problem+json';
const CREDENTIAL = JSON.stringify({ username: 'ada', password: 's3cret-pass' });
const BASIC = `Basic ${Buffer.from('ada:s3cret-pass').toString('base64')}`;

// A version that calls the CRM with basic authentication taken from the `crm` secret.
const aCallingDocument = (): JsonObject => ({
  ...aDocument({}, [
    {
      fetch: {
        call: 'http',
        with: {
          method: 'get',
          endpoint: {
            uri: 'https://crm.example.com/leads/1',
            authentication: { use: 'crmLogin' },
          },
        },
      },
    },
  ]),
  use: {
    secrets: ['crm'],
    authentications: { crmLogin: { basic: { use: 'crm' } } },
  },
});

describe('keeping credentials for workflows (US8)', () => {
  let run: RunApp;
  let t: TestApp;
  let editor: Record<string, string>;
  let other: Record<string, string>;
  let viewer: Record<string, string>;

  beforeAll(async () => {
    run = await createRunApp();
    t = run.t;
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetRuns(t);
    await createUser(t, { email: 'editor@example.com', role: Role.Editor });
    await createUser(t, { email: 'other@example.com', role: Role.Editor });
    await createUser(t, { email: 'viewer@example.com', role: Role.Viewer });
    editor = authHeaders(await signIn(t.server, 'editor@example.com'));
    other = authHeaders(await signIn(t.server, 'other@example.com'));
    viewer = authHeaders(await signIn(t.server, 'viewer@example.com'));
  });

  async function createSecret(
    headers: Record<string, string>,
    name: string,
    value: string,
  ): Promise<void> {
    await request(t.server)
      .post('/api/v1/secrets')
      .set(headers)
      .send({ name, value })
      .expect(201);
  }

  it('a_secret_is_listed_by_name_and_its_value_is_never_returned_nor_stored_plain', async () => {
    const created = await request(t.server)
      .post('/api/v1/secrets')
      .set(editor)
      .send({ name: 'crm', value: CREDENTIAL })
      .expect(201);
    const listed = await request(t.server)
      .get('/api/v1/secrets')
      .set(editor)
      .expect(200);
    const stored = await t.db.execute(sql`select sealed from secret`);

    expect(Object.keys(created.body).sort()).toEqual([
      'createdAt',
      'name',
      'updatedAt',
    ]);
    expect(listed.body).toEqual([created.body]);
    expect(JSON.stringify(stored.rows)).not.toContain('s3cret-pass');
  });

  it('a_name_is_taken_once_per_owner_and_secrets_are_their_owners_own', async () => {
    await createSecret(editor, 'crm', CREDENTIAL);

    const again = await request(t.server)
      .post('/api/v1/secrets')
      .set(editor)
      .send({ name: 'crm', value: 'other' });
    await createSecret(other, 'crm', 'others-value');
    const theirs = await request(t.server).get('/api/v1/secrets').set(other);

    expect(again.status).toBe(409);
    expect(again.headers['content-type']).toContain(PROBLEM);
    expect(theirs.body).toHaveLength(1);
  });

  it('a_viewer_keeps_no_secrets', async () => {
    await request(t.server).get('/api/v1/secrets').set(viewer).expect(403);
  });

  it('a_task_authenticates_with_the_value_of_its_publishers_secret', async () => {
    await createSecret(editor, 'crm', CREDENTIAL);
    await publish(t, editor, aCallingDocument());
    let received: string | undefined;
    run.agent
      .get('https://crm.example.com')
      .intercept({ path: '/leads/1', method: 'GET' })
      .reply((options) => {
        const headers = options.headers as Record<string, string>;
        received = headers.authorization;
        return {
          statusCode: 200,
          data: { id: 1 },
          responseOptions: { headers: { 'content-type': 'application/json' } },
        };
      });

    const { id } = await start(t, editor);
    await drain(t);

    expect((await instanceOf(t, editor, id)).phase).toBe('completed');
    expect(received).toBe(BASIC);
  });

  it('a_replaced_value_is_the_one_the_next_run_uses', async () => {
    await createSecret(editor, 'crm', CREDENTIAL);
    await publish(t, editor, aCallingDocument());
    const replaced = JSON.stringify({ username: 'ada', password: 'n3w-pass' });
    await request(t.server)
      .put('/api/v1/secrets/crm')
      .set(editor)
      .send({ value: replaced })
      .expect(204);
    let received: string | undefined;
    run.agent
      .get('https://crm.example.com')
      .intercept({ path: '/leads/1', method: 'GET' })
      .reply((options) => {
        received = (options.headers as Record<string, string>).authorization;
        return { statusCode: 200, data: '{}' };
      });

    await start(t, editor);
    await drain(t);

    const expected = Buffer.from('ada:n3w-pass').toString('base64');
    expect(received).toBe(`Basic ${expected}`);
  });

  it('a_version_naming_a_secret_its_publisher_does_not_own_is_refused_there', async () => {
    await createSecret(editor, 'crm', CREDENTIAL);

    const response = await request(t.server)
      .post('/api/v1/workflows')
      .set(other)
      .send(aCallingDocument());

    expect(response.status).toBe(422);
    expect(response.body.errors).toEqual([
      { pointer: '/use/secrets/0', detail: "'crm' is not one of your secrets" },
    ]);
  });

  it('a_policy_naming_a_secret_not_declared_in_use_secrets_is_refused', async () => {
    await createSecret(editor, 'crm', CREDENTIAL);
    const document = aCallingDocument();
    const use = document.use as JsonObject;

    const response = await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .send({ ...document, use: { ...use, secrets: [] } });

    expect(response.status).toBe(422);
    expect(response.body.errors[0].pointer).toBe(
      '/use/authentications/crmLogin/basic/use',
    );
  });

  it('a_task_needing_a_deleted_secret_raises_an_authorization_error', async () => {
    await createSecret(editor, 'crm', CREDENTIAL);
    await publish(t, editor, aCallingDocument());
    await request(t.server)
      .delete('/api/v1/secrets/crm')
      .set(editor)
      .expect(204);

    const { id } = await start(t, editor);
    await drain(t);
    const instance = await instanceOf(t, editor, id);

    expect(instance.phase).toBe('faulted');
    expect(instance.error).toMatchObject({
      type: 'https://serverlessworkflow.io/spec/1.0.0/errors/authorization',
      status: 403,
    });
  });

  it('a_value_passed_into_data_is_masked_wherever_the_platform_records_it', async () => {
    await createSecret(editor, 'token', 'tok-12345678');
    await publish(t, editor, {
      ...aDocument({}, [{ keep: { set: { echoed: '${ .token }' } } }]),
      input: { from: '${ { token: $secrets.token } }' },
      use: { secrets: ['token'] },
    });

    const { id } = await start(t, editor);
    await drain(t);
    const instance = await instanceOf(t, editor, id);
    const tasks = await tasksOf(t, editor, id);

    expect(instance.output).toEqual({ echoed: '***' });
    expect(JSON.stringify(tasks)).not.toContain('tok-12345678');
  });
});
