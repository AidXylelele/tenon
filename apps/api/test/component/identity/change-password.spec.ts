import request from "supertest";
import {
  authHeaders,
  cookieHeader,
  createUser,
  PASSWORD,
  signIn,
} from "../../support/auth-helpers.js";
import {
  createTestApp,
  type TestApp,
  withoutInterpreter,
} from "../../support/create-test-app.js";
import { truncateAll } from "../../support/db.js";

const NEW_PASSWORD = "another-long-password-9";

describe("change own password over HTTP", () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp(withoutInterpreter);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    await createUser(t, { email: "user@example.com" });
  });

  const change = (cookie: string, body: Record<string, unknown>) => {
    const sent = {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      ...body,
    };
    const headers = authHeaders(cookie);
    return request(t.server)
      .patch("/api/v1/auth/password")
      .set(headers)
      .send(sent);
  };

  it("the_correct_current_password_replaces_the_password_keeps_the_caller_signed_in_and_ends_other_sessions", async () => {
    const caller = await signIn(t.server, "user@example.com");
    const other = await signIn(t.server, "user@example.com");

    const response = await change(caller, {}).expect(204);

    const fresh = cookieHeader(response.headers["set-cookie"]);
    expect(fresh).toContain("sid=");
    const freshHeaders = authHeaders(fresh);
    await request(t.server)
      .get("/api/v1/probe/user")
      .set(freshHeaders)
      .expect(200);
    const otherHeaders = authHeaders(other);
    await request(t.server)
      .get("/api/v1/probe/user")
      .set(otherHeaders)
      .expect(401);
    await request(t.server)
      .post("/api/v1/auth/session")
      .send({ email: "user@example.com", password: PASSWORD })
      .expect(401);
    await signIn(t.server, "user@example.com", NEW_PASSWORD);
  });

  it("a_wrong_current_password_is_refused_and_the_password_stays", async () => {
    const caller = await signIn(t.server, "user@example.com");

    const response = await change(caller, {
      currentPassword: "not-the-current-password",
    }).expect(422);

    expect(response.body).toMatchObject({
      type: "urn:problem:account.wrong-password",
      detail: "The current password is wrong",
    });
    await signIn(t.server, "user@example.com", PASSWORD);
  });

  const tooLong = "a".repeat(129);

  it.each([
    { case: "too short", newPassword: "short1" },
    { case: "too long", newPassword: tooLong },
  ])(
    "a_new_password_outside_the_policy_is_refused ($case)",
    async ({ newPassword }) => {
      const caller = await signIn(t.server, "user@example.com");

      await change(caller, { newPassword }).expect(400);

      await signIn(t.server, "user@example.com", PASSWORD);
    },
  );

  it("a_request_without_a_session_is_refused", async () => {
    await request(t.server)
      .patch("/api/v1/auth/password")
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(401);
  });
});
