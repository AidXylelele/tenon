import { createOpenApiDocument } from '../../src/frameworks/swagger/open-api.js';
import { createTestApp, type TestApp } from '../support/create-test-app.js';

describe('the OpenAPI document', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('describes_every_route_the_api_serves', () => {
    const document = createOpenApiDocument(t.app);

    const paths = Object.keys(document.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/v1/workflows',
        '/api/v1/workflows/{namespace}/{name}/instances',
        '/api/v1/instances',
        '/api/v1/instances/{id}',
        '/api/v1/instances/{id}/tasks',
        '/api/v1/instances/{id}/events',
      ]),
    );
  });

  it('describes_the_start_time_filters_as_date_times', () => {
    const document = createOpenApiDocument(t.app);

    const parameters = document.paths['/api/v1/instances']?.get?.parameters;
    const startedFrom = parameters?.find(
      (parameter) => 'name' in parameter && parameter.name === 'startedFrom',
    );
    expect(startedFrom).toMatchObject({
      in: 'query',
      schema: { type: 'string', format: 'date-time' },
    });
  });
});
