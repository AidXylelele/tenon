import { RequestPath } from "../../../../src/frameworks/opentelemetry/request-path.js";

describe("the path of an incoming request as telemetry shows it", () => {
  it("a_hook_call_shows_its_route_instead_of_its_token", () => {
    const path = new RequestPath("/api/v1/hooks/whk_secret-token?source=crm");

    expect(path.isHook()).toBe(true);
    expect(path.redacted()).toBe("/api/v1/hooks/:token");
  });

  it("any_other_request_shows_its_path_without_the_query", () => {
    const path = new RequestPath("/api/v1/instances?cursor=abc&limit=20");

    expect(path.isHook()).toBe(false);
    expect(path.redacted()).toBe("/api/v1/instances");
  });

  it("the_health_checks_are_recognised_by_their_path", () => {
    const ready = new RequestPath("/api/v1/health/ready");
    const workflows = new RequestPath("/api/v1/workflows");

    expect(ready.isHealth()).toBe(true);
    expect(workflows.isHealth()).toBe(false);
  });

  it("a_request_without_a_url_shows_an_empty_path", () => {
    const path = new RequestPath(undefined);

    expect(path.redacted()).toBe("");
  });
});
