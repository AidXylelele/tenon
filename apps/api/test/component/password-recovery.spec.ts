import { sql } from "drizzle-orm";
import request from "supertest";
import { Role } from "../../src/domain/identity/users/enums.js";
import {
  authHeaders,
  createUser,
  PASSWORD,
  SEED_ADMIN_EMAIL,
  seedAdministrator,
  signIn,
  suspendUser,
} from "../support/auth-helpers.js";
import {
  createTestApp,
  type TestApp,
  withoutInterpreter,
} from "../support/create-test-app.js";
import { truncateAll } from "../support/db.js";
import {
  invitationTokenFor,
  recoveryTokenFor,
} from "../support/mail-helpers.js";

const NEW_PASSWORD = "new-correct-horse-battery";

describe("password recovery over HTTP", () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp(withoutInterpreter);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    t.mail.clear();
  });

  const requestRecovery = (email: string) =>
    request(t.server).post("/api/v1/auth/password-recovery").send({ email });

  const complete = (token: string, newPassword = NEW_PASSWORD) =>
    request(t.server)
      .post("/api/v1/auth/password-recovery/complete")
      .send({ token, newPassword });

  it("the_answer_is_the_same_for_a_known_and_an_unknown_email", async () => {
    await createUser(t, { email: "user@example.com" });
    const unknownHandled = t.recoveryHandled("nobody@example.com");

    const known = await requestRecovery("user@example.com").expect(202);
    const unknown = await requestRecovery("nobody@example.com").expect(202);
    await unknownHandled;
    await t.untilMailQueued();

    expect(known.text).toBe(unknown.text);
  });

  it("a_known_email_gets_a_reset_link", async () => {
    await createUser(t, { email: "user@example.com" });

    await requestRecovery("user@example.com").expect(202);
    const mail = await t.untilMailDeliveredTo("user@example.com");

    expect(t.mail.mails).toHaveLength(1);
    const text = mail.text;
    expect(text).toMatch(/reset-password\?token=/);
  });

  it("an_unknown_email_gets_no_mail", async () => {
    await createUser(t, { email: "user@example.com" });
    const handled = t.recoveryHandled("nobody@example.com");

    await requestRecovery("nobody@example.com").expect(202);
    await handled;
    await t.deliverOutbox();

    const mail = t.mail.lastTo("nobody@example.com");
    expect(mail).toBeNull();
  });

  it("a_suspended_account_gets_the_generic_answer_and_no_mail", async () => {
    const user = await createUser(t, { email: "user@example.com" });
    await suspendUser(t.db, user.id);
    const handled = t.recoveryHandled("user@example.com");

    await requestRecovery("user@example.com").expect(202);
    await handled;
    await t.deliverOutbox();

    const mail = t.mail.lastTo("user@example.com");
    expect(mail).toBeNull();
  });

  it("completing_recovery_replaces_the_password_consumes_the_link_and_ends_every_other_session", async () => {
    await createUser(t, { email: "user@example.com" });
    const earlier = await signIn(t.server, "user@example.com");
    await requestRecovery("user@example.com").expect(202);
    const token = await recoveryTokenFor(t, "user@example.com");

    await complete(token).expect(204);

    const earlierHeaders = authHeaders(earlier);
    await request(t.server)
      .get("/api/v1/probe/user")
      .set(earlierHeaders)
      .expect(401);
    await request(t.server)
      .post("/api/v1/auth/session")
      .send({ email: "user@example.com", password: PASSWORD })
      .expect(401);
    await signIn(t.server, "user@example.com", NEW_PASSWORD);
    await complete(token, "another-long-password-1").expect(400);
  });

  it("an_expired_link_is_refused", async () => {
    await createUser(t, { email: "user@example.com" });
    await requestRecovery("user@example.com").expect(202);
    const token = await recoveryTokenFor(t, "user@example.com");
    await t.db.execute(
      sql`update email_token set expires_at = now() - interval '1 minute'`,
    );

    await complete(token).expect(400);
  });

  it("an_earlier_link_still_works_after_a_newer_one_is_issued", async () => {
    await createUser(t, { email: "user@example.com" });
    await requestRecovery("user@example.com").expect(202);
    const first = await recoveryTokenFor(t, "user@example.com");
    t.mail.clear();
    await requestRecovery("user@example.com").expect(202);
    const second = await recoveryTokenFor(t, "user@example.com");

    await complete(first, "first-new-password-1").expect(204);

    expect(second).not.toBe(first);
    await signIn(t.server, "user@example.com", "first-new-password-1");
  });

  it("a_link_issued_before_the_password_change_stops_working", async () => {
    await createUser(t, { email: "user@example.com" });
    await requestRecovery("user@example.com").expect(202);
    const first = await recoveryTokenFor(t, "user@example.com");
    t.mail.clear();
    await requestRecovery("user@example.com").expect(202);
    const second = await recoveryTokenFor(t, "user@example.com");
    await complete(first, "first-new-password-1").expect(204);

    await complete(second, "second-new-password-2").expect(400);

    await signIn(t.server, "user@example.com", "first-new-password-1");
  });

  it("a_password_outside_the_policy_is_refused_and_the_link_stays_usable", async () => {
    await createUser(t, { email: "user@example.com" });
    await requestRecovery("user@example.com").expect(202);
    const token = await recoveryTokenFor(t, "user@example.com");

    await complete(token, "short1").expect(400);

    await complete(token).expect(204);
  });

  it("when_the_mail_server_fails_the_answer_stays_generic_and_nothing_is_delivered", async () => {
    await createUser(t, { email: "user@example.com" });
    const unavailable = new Error("smtp unavailable");
    t.mail.failNext(unavailable);

    await requestRecovery("user@example.com").expect(202);
    await t.untilMailQueued();
    await t.deliverOutbox();

    expect(t.mail.mails).toHaveLength(0);
  });

  it("an_email_with_only_a_pending_invitation_gets_the_generic_answer_and_the_invitation_is_untouched", async () => {
    await createUser(t, { email: "admin@example.com", role: Role.Admin });
    const adminCookie = await signIn(t.server, "admin@example.com");
    const admin = authHeaders(adminCookie);
    await request(t.server)
      .post("/api/v1/invitations")
      .set(admin)
      .send({ email: "invited@example.com", role: "viewer" })
      .expect(201);
    const token = await invitationTokenFor(t, "invited@example.com");
    t.mail.clear();
    const handled = t.recoveryHandled("invited@example.com");

    await requestRecovery("invited@example.com").expect(202);
    await handled;
    await t.deliverOutbox();

    const mail = t.mail.lastTo("invited@example.com");
    expect(mail).toBeNull();
    await request(t.server)
      .post("/api/v1/invitations/verify")
      .send({ token })
      .expect(200);
  });

  it("a_link_issued_before_suspension_is_refused_afterwards", async () => {
    const user = await createUser(t, { email: "user@example.com" });
    await requestRecovery("user@example.com").expect(202);
    const token = await recoveryTokenFor(t, "user@example.com");
    await suspendUser(t.db, user.id);

    await complete(token).expect(400);
  });

  it("the_seeded_administrator_sets_the_first_password_through_recovery_and_signs_in_as_admin", async () => {
    await seedAdministrator(t);
    await requestRecovery(SEED_ADMIN_EMAIL).expect(202);
    const token = await recoveryTokenFor(t, SEED_ADMIN_EMAIL);

    await complete(token, "first-admin-password").expect(204);

    const cookie = await signIn(
      t.server,
      SEED_ADMIN_EMAIL,
      "first-admin-password",
    );
    const admin = authHeaders(cookie);
    await request(t.server).get("/api/v1/probe/admin").set(admin).expect(200);
  });
});
