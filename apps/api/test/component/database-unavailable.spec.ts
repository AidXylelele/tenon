import request from 'supertest';
import { WorkflowQueries } from '../../src/application/automation/workflows/queries.js';
import { Role } from '../../src/domain/identity/enums.js';
import { authHeaders, createUser, signIn } from '../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../support/create-test-app.js';
import { truncateAll } from '../support/db.js';

// PostgreSQL's "too many clients already" (53300), the way pg reports it.
function outage(): Error {
  const error = new Error('sorry, too many clients already');
  Reflect.set(error, 'code', '53300');
  return error;
}

describe('a database outage over HTTP', () => {
  let t: TestApp;
  let failure: () => Error = outage;

  beforeAll(async () => {
    const queries = {
      list: () => Promise.reject(failure()),
    };
    t = await createTestApp((builder) =>
      builder.overrideProvider(WorkflowQueries).useValue(queries),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    await createUser(t, { email: 'viewer@example.com', role: Role.Viewer });
  });

  it('a_transient_database_failure_answers_503_with_retry_after', async () => {
    failure = outage;
    const viewer = authHeaders(await signIn(t.server, 'viewer@example.com'));

    const response = await request(t.server)
      .get('/api/v1/workflows')
      .set(viewer)
      .expect(503);

    expect(response.headers['retry-after']).toBe('5');
  });

  it('any_other_failure_stays_an_internal_error', async () => {
    failure = () => new Error('a defect');
    const viewer = authHeaders(await signIn(t.server, 'viewer@example.com'));

    await request(t.server).get('/api/v1/workflows').set(viewer).expect(500);
  });
});
