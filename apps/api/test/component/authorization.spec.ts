import request from "supertest";
import { Role } from "../../src/domain/identity/enums.js";
import { authHeaders, createUser, signIn } from "../support/auth-helpers.js";
import {
  createTestApp,
  type TestApp,
  withoutInterpreter,
} from "../support/create-test-app.js";
import { truncateAll } from "../support/db.js";

describe("authentication, authorization policies and error responses", () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp(withoutInterpreter);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
  });

  it("the_liveness_route_is_public_and_checks_no_dependency", async () => {
    const response = await request(t.server)
      .get("/api/v1/health/live")
      .expect(200);

    expect(response.body).toEqual({
      status: "ok",
      info: {},
      error: {},
      details: {},
    });
  });

  it("the_readiness_route_is_public_and_checks_the_database", async () => {
    const response = await request(t.server)
      .get("/api/v1/health/ready")
      .expect(200);

    expect(response.body).toMatchObject({
      status: "ok",
      details: { database: { status: "up" } },
    });
  });

  it("a_protected_route_without_a_cookie_is_refused_as_unauthenticated", async () => {
    const response = await request(t.server)
      .get("/api/v1/probe/user")
      .expect(401);

    expect(response.body).toMatchObject({ status: 401 });
  });

  it("an_editor_passes_a_route_open_to_anyone_signed_in", async () => {
    await createUser(t, { email: "editor@example.com", role: Role.Editor });
    const cookie = await signIn(t.server, "editor@example.com");
    const editor = authHeaders(cookie);

    await request(t.server).get("/api/v1/probe/user").set(editor).expect(200);
  });

  it("an_editor_is_refused_by_the_administrator_policy", async () => {
    await createUser(t, { email: "editor@example.com", role: Role.Editor });
    const cookie = await signIn(t.server, "editor@example.com");
    const editor = authHeaders(cookie);

    const response = await request(t.server)
      .get("/api/v1/probe/admin")
      .set(editor)
      .expect(403);

    expect(response.body).toMatchObject({ status: 403 });
  });

  it("an_administrator_passes_the_administrator_policy", async () => {
    await createUser(t, { email: "admin@example.com", role: Role.Admin });
    const cookie = await signIn(t.server, "admin@example.com");
    const admin = authHeaders(cookie);

    await request(t.server).get("/api/v1/probe/admin").set(admin).expect(200);
  });

  it("an_unknown_route_answers_with_not_found", async () => {
    const response = await request(t.server).get("/api/v1/nope").expect(404);

    expect(response.body).toMatchObject({ status: 404 });
  });

  it("an_error_without_an_http_mapping_is_answered_as_an_internal_error_without_details", async () => {
    const response = await request(t.server)
      .get("/api/v1/probe/unmapped-error")
      .expect(500);

    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.body).toEqual({
      type: "about:blank",
      title: "Internal Server Error",
      status: 500,
      detail: "The platform failed while answering; try again later",
    });
  });

  it("a_full_pool_answers_service_unavailable_with_a_retry_after", async () => {
    const response = await request(t.server)
      .get("/api/v1/probe/full-pool")
      .expect(503);

    expect(response.headers["retry-after"]).toMatch(/^\d+$/);
    expect(response.body).toMatchObject({
      type: "about:blank",
      title: "Service Unavailable",
      status: 503,
      code: "BULKHEAD_FULL",
    });
  });

  it("responses_carry_the_hardening_headers_and_no_server_banner", async () => {
    const response = await request(t.server)
      .get("/api/v1/health/live")
      .expect(200);

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["content-security-policy"]).toContain(
      "default-src 'self'",
    );
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});
