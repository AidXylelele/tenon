import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { createTestApp, type TestApp } from "../support/create-test-app.js";

describe("the OpenAPI document", () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it("describes_every_route_the_api_serves", () => {
    const options = new DocumentBuilder().setTitle("Tenon API").build();
    const document = SwaggerModule.createDocument(t.app, options);

    const paths = Object.keys(document.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/api/v1/workflows",
        "/api/v1/workflows/check",
        "/api/v1/workflows/{namespace}/{name}",
        "/api/v1/workflows/{namespace}/{name}/archive",
        "/api/v1/workflows/{namespace}/{name}/versions",
        "/api/v1/workflows/{namespace}/{name}/versions/{version}",
        "/api/v1/workflows/{namespace}/{name}/draft/test-runs",
        "/api/v1/instance-counts",
        "/api/v1/members",
        "/api/v1/expected-starts",
      ]),
    );
  });
});
