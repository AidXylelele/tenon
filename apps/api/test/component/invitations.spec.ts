import request from "supertest";
import { z } from "zod";
import { Role } from "../../src/domain/identity/users/enums.js";
import {
  authHeaders,
  cookieHeader,
  createUser,
  PASSWORD,
  signIn,
} from "../support/auth-helpers.js";
import {
  createTestApp,
  type TestApp,
  withoutInterpreter,
} from "../support/create-test-app.js";
import { truncateAll } from "../support/db.js";
import { invitationTokenFor } from "../support/mail-helpers.js";

const CreatedInvitation = z.object({ id: z.string() });

const SetCookieHeaders = z.object({
  "set-cookie": z.array(z.string()).default([]),
});

describe("invitations over HTTP", () => {
  let t: TestApp;
  let adminCookie: string;

  beforeAll(async () => {
    t = await createTestApp(withoutInterpreter);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    t.mail.clear();
    await createUser(t, {
      email: "admin@example.com",
      role: Role.Admin,
      name: "Ada Admin",
    });
    adminCookie = await signIn(t.server, "admin@example.com");
  });

  const invite = (email: string, role = "editor", cookie = adminCookie) => {
    const headers = authHeaders(cookie);
    return request(t.server)
      .post("/api/v1/invitations")
      .set(headers)
      .send({ email, role });
  };

  const invitedId = async (email: string) => {
    const created = await invite(email).expect(201);
    const invitation = CreatedInvitation.parse(created.body);
    return invitation.id;
  };

  const list = (cookie = adminCookie) => {
    const headers = authHeaders(cookie);
    return request(t.server).get("/api/v1/invitations").set(headers);
  };

  const revoke = (id: string, cookie = adminCookie) => {
    const headers = authHeaders(cookie);
    return request(t.server).delete(`/api/v1/invitations/${id}`).set(headers);
  };

  const verify = (token: string) =>
    request(t.server).post("/api/v1/invitations/verify").send({ token });

  const accept = (
    token: string,
    body: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) => {
    const sent = { token, name: "Newcomer", password: PASSWORD, ...body };
    return request(t.server)
      .post("/api/v1/invitations/accept")
      .set(headers)
      .send(sent);
  };

  it("an_administrator_creates_an_invitation_and_the_invited_person_gets_the_link_by_email_after_the_outbox_run", async () => {
    const response = await invite("new@example.com").expect(201);

    expect(response.body).toMatchObject({
      email: "new@example.com",
      role: "editor",
      status: "pending",
    });
    expect(t.mail.mails).toHaveLength(0);
    const token = await invitationTokenFor(t, "new@example.com");
    const text = t.mail.lastTo("new@example.com")?.text;
    expect(text).toContain("Ada Admin");
    await verify(token).expect(200);
  });

  it("an_editor_cannot_invite", async () => {
    await createUser(t, { email: "editor@example.com", role: Role.Editor });
    const editorCookie = await signIn(t.server, "editor@example.com");

    const forbidden = await invite(
      "new@example.com",
      "viewer",
      editorCookie,
    ).expect(403);

    expect(forbidden.body).toMatchObject({ status: 403 });
  });

  it("an_anonymous_caller_cannot_invite", async () => {
    await request(t.server)
      .post("/api/v1/invitations")
      .send({ email: "new@example.com", role: "viewer" })
      .expect(401);
  });

  it("an_editor_cannot_list_invitations", async () => {
    await createUser(t, { email: "editor@example.com", role: Role.Editor });
    const editorCookie = await signIn(t.server, "editor@example.com");

    await list(editorCookie).expect(403);
  });

  it("an_email_with_an_account_is_refused_as_a_conflict", async () => {
    const response = await invite("admin@example.com").expect(409);

    expect(response.body).toMatchObject({ status: 409 });
  });

  it("an_invalid_email_or_role_is_refused_with_every_validation_message", async () => {
    const response = await invite("nope", "owner").expect(400);

    expect(response.body).toMatchObject({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail:
        'email: Invalid email address; role: Invalid option: expected one of "admin"|"editor"|"viewer"',
    });
  });

  it("the_link_of_a_pending_invitation_verifies", async () => {
    await invite("new@example.com").expect(201);
    const token = await invitationTokenFor(t, "new@example.com");

    const verified = await verify(token).expect(200);
    const anyText: unknown = expect.any(String);

    expect(verified.body).toMatchObject({
      email: "new@example.com",
      role: "editor",
      expiresAt: anyText,
    });
  });

  it("accepting_creates_the_user_and_signs_them_in", async () => {
    await invite("new@example.com").expect(201);
    const token = await invitationTokenFor(t, "new@example.com");

    const accepted = await accept(token).expect(200);

    expect(accepted.body).toMatchObject({
      user: { email: "new@example.com", name: "Newcomer", role: "editor" },
    });
    const cookieHeaders = SetCookieHeaders.parse(accepted.headers);
    const cookies = cookieHeaders["set-cookie"];
    const cookieLine = cookies.join(";");
    expect(cookieLine).toContain("sid=");
    const cookie = cookieHeader(cookies);
    const headers = authHeaders(cookie);
    await request(t.server).get("/api/v1/probe/user").set(headers).expect(200);
  });

  it("a_used_link_no_longer_verifies", async () => {
    await invite("new@example.com").expect(201);
    const token = await invitationTokenFor(t, "new@example.com");
    await accept(token).expect(200);

    const used = await verify(token).expect(410);

    expect(used.body).toMatchObject({ status: 410 });
  });

  it("a_used_link_cannot_be_accepted_again", async () => {
    await invite("new@example.com").expect(201);
    const token = await invitationTokenFor(t, "new@example.com");
    await accept(token).expect(200);

    await accept(token).expect(410);
  });

  const tooLong = "a".repeat(129);

  it.each([
    {
      case: "too short",
      password: "short1",
      message: "password: Too small: expected string to have >=12 characters",
    },
    {
      case: "too long",
      password: tooLong,
      message: "password: Too big: expected string to have <=128 characters",
    },
  ])(
    "a_password_outside_the_policy_is_refused_and_the_invitation_stays_usable ($case)",
    async ({ password, message }) => {
      await invite("new@example.com").expect(201);
      const token = await invitationTokenFor(t, "new@example.com");

      const refused = await accept(token, { password }).expect(400);

      expect(refused.body).toMatchObject({ status: 400, detail: message });
      await verify(token).expect(200);
    },
  );

  it("accepting_while_signed_in_ends_the_existing_session_first", async () => {
    await invite("new@example.com").expect(201);
    const token = await invitationTokenFor(t, "new@example.com");
    const admin = authHeaders(adminCookie);

    await accept(token, {}, admin).expect(200);

    await request(t.server).get("/api/v1/probe/user").set(admin).expect(401);
  });

  it("a_pending_invitation_is_listed", async () => {
    const id = await invitedId("new@example.com");

    const listed = await list().expect(200);

    expect(listed.body).toMatchObject([{ id, status: "pending" }]);
  });

  it("a_revoked_invitation_stays_in_the_list_as_revoked", async () => {
    const id = await invitedId("new@example.com");

    await revoke(id).expect(204);

    const after = await list().expect(200);
    expect(after.body).toMatchObject([{ id, status: "revoked" }]);
  });

  it("the_link_of_a_revoked_invitation_is_refused_as_gone", async () => {
    const id = await invitedId("new@example.com");
    const token = await invitationTokenFor(t, "new@example.com");
    await revoke(id).expect(204);

    const refused = await verify(token).expect(410);

    expect(refused.body).toMatchObject({ status: 410 });
  });

  it("revoking_a_revoked_invitation_is_refused_as_gone", async () => {
    const id = await invitedId("new@example.com");
    await revoke(id).expect(204);

    await revoke(id).expect(410);
  });

  it("revoking_an_unknown_invitation_is_not_found", async () => {
    await invite("new@example.com").expect(201);

    await revoke("00000000-0000-0000-0000-000000000000").expect(404);
  });

  it("simultaneous_acceptances_of_one_link_create_one_account_and_refuse_the_rest", async () => {
    await invite("new@example.com").expect(201);
    const token = await invitationTokenFor(t, "new@example.com");
    const attempts = Array.from({ length: 5 }, (_, i) =>
      accept(token, { name: `Racer ${String(i)}` }),
    );

    const responses = await Promise.all(attempts);

    const statuses = responses.map((response) => response.status);
    const accepted = statuses.filter((status) => status === 200);
    expect(accepted).toHaveLength(1);
    const unexpected = statuses.filter(
      (status) => status !== 200 && status !== 409 && status !== 410,
    );
    expect(unexpected).toEqual([]);
    await signIn(t.server, "new@example.com");
  });

  it("revoking_an_accepted_invitation_is_refused_and_the_account_keeps_working", async () => {
    const id = await invitedId("new@example.com");
    const token = await invitationTokenFor(t, "new@example.com");
    await accept(token).expect(200);

    const refused = await revoke(id).expect(410);

    expect(refused.body).toMatchObject({ status: 410 });
    await signIn(t.server, "new@example.com");
  });

  it("a_second_invitation_for_a_pending_email_replaces_the_first_link", async () => {
    await invite("new@example.com").expect(201);
    const first = await invitationTokenFor(t, "new@example.com");

    await invite("new@example.com", "viewer").expect(201);

    const second = await invitationTokenFor(t, "new@example.com");
    expect(second).not.toBe(first);
    const firstRefused = await verify(first).expect(410);
    expect(firstRefused.body).toMatchObject({ status: 410 });
    const verified = await verify(second).expect(200);
    expect(verified.body).toMatchObject({ role: "viewer" });
  });

  it("an_unknown_token_is_not_found", async () => {
    await invite("new@example.com").expect(201);
    const unknown = "x".repeat(43);

    const response = await verify(unknown).expect(404);

    expect(response.body).toMatchObject({ status: 404 });
  });

  it("when_the_mail_server_fails_the_invitation_still_exists_and_no_mail_is_lost", async () => {
    const unavailable = new Error("smtp unavailable");
    t.mail.failNext(unavailable);
    const id = await invitedId("new@example.com");

    await t.deliverOutbox();

    expect(t.mail.mails).toHaveLength(0);
    const listed = await list().expect(200);
    expect(listed.body).toMatchObject([{ id }]);
  });
});
