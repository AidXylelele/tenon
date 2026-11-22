import { getStorageToken, ThrottlerStorageService } from "@nestjs/throttler";
import request from "supertest";
import {
  createTestApp,
  type TestApp,
  withoutInterpreter,
} from "../support/create-test-app.js";
import { truncateAll } from "../support/db.js";

const PASSWORD = "not-the-password-of-anyone";

describe("rate limits on the routes that check a secret or take outside calls", () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp((builder) =>
      withoutInterpreter(builder)
        .overrideProvider(getStorageToken())
        .useValue(new ThrottlerStorageService()),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
  });

  const RETRY_AFTER = /^\d+$/;

  const statuses = async (
    count: number,
    send: (attempt: number) => request.Test,
  ): Promise<number[]> => {
    const answered: number[] = [];

    for (let attempt = 0; attempt < count; attempt++) {
      const response = await send(attempt);
      answered.push(response.status);
    }

    return answered;
  };

  const signIn = (email: string, address: string) =>
    request(t.server)
      .post("/api/v1/auth/session")
      .set("x-forwarded-for", address)
      .send({ email, password: PASSWORD });

  it("sign_in_refuses_the_eleventh_attempt_at_one_account_from_any_address_and_still_answers_another_account", async () => {
    const tries = await statuses(11, (attempt) =>
      signIn("guessed@example.com", `203.0.113.${String(10 + attempt)}`),
    );
    const refused = await signIn("guessed@example.com", "198.51.100.7");
    const other = await signIn("other@example.com", "198.51.100.7");

    expect(tries.slice(0, 10)).toEqual(Array<number>(10).fill(401));
    expect(tries[10]).toBe(429);
    expect(refused.status).toBe(429);
    expect(refused.headers["retry-after"]).toMatch(RETRY_AFTER);
    expect(other.status).toBe(401);
  });

  it("password_recovery_refuses_the_fourth_request_for_one_address_whatever_the_client_address", async () => {
    const requests = await statuses(4, (attempt) =>
      request(t.server)
        .post("/api/v1/auth/password-recovery")
        .set("x-forwarded-for", `203.0.113.${String(20 + attempt)}`)
        .send({ email: "Flooded@Example.com " }),
    );
    const refused = await request(t.server)
      .post("/api/v1/auth/password-recovery")
      .set("x-forwarded-for", "203.0.113.29")
      .send({ email: "Flooded@Example.com " });

    expect(requests).toEqual([202, 202, 202, 429]);
    expect(refused.status).toBe(429);
    expect(refused.headers["retry-after"]).toMatch(RETRY_AFTER);
  });

  it("invitation_acceptance_refuses_the_eleventh_attempt_from_one_address", async () => {
    const tries = await statuses(11, (attempt) =>
      request(t.server)
        .post("/api/v1/invitations/accept")
        .set("x-forwarded-for", "203.0.113.30")
        .send({
          token: `${"t".repeat(40)}${String(attempt)}`,
          name: "Guest",
          password: PASSWORD,
        }),
    );

    expect(tries.slice(0, 10)).not.toContain(429);
    expect(tries[10]).toBe(429);
  });

  it("a_webhook_sender_gets_too_many_requests_past_300_calls_a_minute", async () => {
    const calls = await statuses(301, () =>
      request(t.server)
        .post("/api/v1/hooks/unknown-token")
        .set("x-forwarded-for", "203.0.113.40")
        .set("content-type", "application/json")
        .send("{}"),
    );
    const refused = await request(t.server)
      .post("/api/v1/hooks/unknown-token")
      .set("x-forwarded-for", "203.0.113.40")
      .send("{}");

    expect(calls.slice(0, 300)).not.toContain(429);
    expect(calls[300]).toBe(429);
    expect(refused.headers["retry-after"]).toMatch(RETRY_AFTER);
  });

  it("event_intake_counts_unauthenticated_calls_before_the_authentication_guard_refuses_them", async () => {
    const calls = await statuses(301, () =>
      request(t.server)
        .post("/api/v1/events")
        .set("x-forwarded-for", "203.0.113.50")
        .set("content-type", "application/json")
        .send("{}"),
    );

    expect(calls.slice(0, 300)).toEqual(Array<number>(300).fill(401));
    expect(calls[300]).toBe(429);
  });
});
