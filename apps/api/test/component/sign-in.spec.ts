import request from "supertest";
import {
  authHeaders,
  cookieHeader,
  createUser,
  expireSession,
  PASSWORD,
  signIn,
  suspendUser,
} from "../support/auth-helpers.js";
import {
  createTestApp,
  type TestApp,
  withoutInterpreter,
} from "../support/create-test-app.js";
import { truncateAll } from "../support/db.js";

describe("sign in and sign out over HTTP", () => {
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

  const attempt = (email: string, password: string) =>
    request(t.server).post("/api/v1/auth/session").send({ email, password });

  it("correct_credentials_establish_an_http_only_lax_session_cookie_and_return_the_user", async () => {
    await createUser(t, { email: "user@example.com", name: "User" });

    const response = await attempt("user@example.com", PASSWORD).expect(200);

    expect(response.body).toMatchObject({
      user: { email: "user@example.com", name: "User", role: "viewer" },
    });
    const cookies = (response.headers["set-cookie"] ?? []) as string[];
    const session = cookies.find((cookie) => cookie.startsWith("sid="));
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);
    expect(session).not.toMatch(/Secure/);
    const cookie = cookieHeader(cookies);
    const headers = authHeaders(cookie);
    const me = await request(t.server)
      .get("/api/v1/auth/session")
      .set(headers)
      .expect(200);
    expect(me.body).toMatchObject({ user: { email: "user@example.com" } });
  });

  it("a_wrong_password_and_an_unknown_email_get_byte_identical_responses", async () => {
    await createUser(t, { email: "user@example.com" });

    const wrongPassword = await attempt(
      "user@example.com",
      "definitely-not-the-password",
    ).expect(401);
    const unknownEmail = await attempt(
      "nobody@example.com",
      "definitely-not-the-password",
    ).expect(401);

    expect(wrongPassword.text).toBe(unknownEmail.text);
    expect(wrongPassword.body).toMatchObject({ status: 401 });
  });

  it("sign_out_ends_the_session_and_the_cookie_is_refused_afterwards", async () => {
    await createUser(t, { email: "user@example.com" });
    const cookie = await signIn(t.server, "user@example.com");
    const headers = authHeaders(cookie);
    await request(t.server).get("/api/v1/probe/user").set(headers).expect(200);

    await request(t.server)
      .delete("/api/v1/auth/session")
      .set(headers)
      .expect(204);

    const refused = await request(t.server)
      .get("/api/v1/probe/user")
      .set(headers)
      .expect(401);
    expect(refused.body).toMatchObject({ status: 401 });
  });

  it("a_session_past_its_lifetime_is_refused", async () => {
    await createUser(t, { email: "user@example.com" });
    const cookie = await signIn(t.server, "user@example.com");
    const headers = authHeaders(cookie);

    await expireSession(t.db, cookie);

    await request(t.server).get("/api/v1/probe/user").set(headers).expect(401);
  });

  it("a_suspended_users_sessions_stop_working", async () => {
    const user = await createUser(t, { email: "user@example.com" });
    const cookie = await signIn(t.server, "user@example.com");
    const headers = authHeaders(cookie);

    await suspendUser(t.db, user.id);

    await request(t.server).get("/api/v1/probe/user").set(headers).expect(401);
  });

  it("a_suspended_user_is_refused_at_sign_in_with_a_suspension_message", async () => {
    const user = await createUser(t, { email: "user@example.com" });
    await suspendUser(t.db, user.id);

    const refused = await attempt("user@example.com", PASSWORD).expect(403);

    expect(refused.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(refused.body).toMatchObject({
      type: "urn:problem:user.suspended",
      status: 403,
      detail: "The account is suspended",
    });
  });

  it("email_addresses_are_compared_without_case_or_surrounding_spaces", async () => {
    await createUser(t, { email: "user@example.com" });

    await attempt(" User@Example.COM ", PASSWORD).expect(200);
  });
});
