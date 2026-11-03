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
        '/api/v1/workflows/check',
        '/api/v1/workflows/{namespace}/{name}',
        '/api/v1/workflows/{namespace}/{name}/archive',
        '/api/v1/workflows/{namespace}/{name}/versions',
        '/api/v1/workflows/{namespace}/{name}/versions/{version}',
      ]),
    );
  });
});
