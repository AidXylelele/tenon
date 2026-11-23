import { sql } from "drizzle-orm";
import request from "supertest";
import type { JsonObject } from "../../../src/domain/automation/interfaces.js";
import { Role } from "../../../src/domain/identity/users/enums.js";
import { authHeaders, createUser, signIn } from "../../support/auth-helpers.js";
import { aDocument } from "../../support/builders.js";
import type { TestApp } from "../../support/create-test-app.js";
import {
  createRunApp,
  drain,
  publish,
  type RunApp,
  relay,
  resetRuns,
} from "../../support/run-helpers.js";

interface Expected {
  readonly namespace: string;
  readonly name: string;
  readonly next: readonly string[];
  readonly missed: number;
  readonly missedSince: string;
}

const aScheduledDocument = (name: string, schedule: JsonObject) => ({
  ...aDocument({ name }, [{ greet: { set: { greeted: true } } }]),
  schedule,
});

describe("the starts a schedule is expected to make", () => {
  let run: RunApp;
  let t: TestApp;
  let editor: Record<string, string>;
  let viewer: Record<string, string>;

  beforeAll(async () => {
    run = await createRunApp();
    t = run.t;
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    run.clock.set(Date.UTC(2026, 0, 1));
    await resetRuns(t);
    await t.db.execute(sql`truncate table nest_workflows.schedules cascade`);
    await createUser(t, { email: "editor@example.com", role: Role.Editor });
    await createUser(t, { email: "viewer@example.com", role: Role.Viewer });
    editor = authHeaders(await signIn(t.server, "editor@example.com"));
    viewer = authHeaders(await signIn(t.server, "viewer@example.com"));
  });

  async function turnOn(name: string): Promise<void> {
    await request(t.server)
      .post(`/api/v1/workflows/sales/${name}/turn-on`)
      .set(editor)
      .expect(204);
    await relay(t);
  }

  async function pass(duration: `${number}m`): Promise<void> {
    run.clock.advance(duration);
    await drain(t);
    await relay(t);
    await drain(t);
  }

  async function expectedSince(from: string): Promise<Expected[]> {
    const response = await request(t.server)
      .get(`/api/v1/expected-starts?from=${from}`)
      .set(viewer)
      .expect(200);
    return response.body as Expected[];
  }

  it("names_the_next_starts_and_counts_the_occurrences_that_started_no_run", async () => {
    await publish(
      t,
      editor,
      aScheduledDocument("every-minute", { every: { minutes: 1 } }),
    );
    await turnOn("every-minute");
    await pass("1m");
    await pass("1m");
    run.clock.advance("4m");
    await pass("1m");

    const [expected] = await expectedSince("2025-12-31T00:00:00.000Z");

    expect(expected).toMatchObject({
      namespace: "sales",
      name: "every-minute",
      title: null,
      lastRun: { phase: "completed" },
      missed: 4,
      missedSince: "2026-01-01T00:01:00.000Z",
    });
    expect(expected?.next).toHaveLength(10);
    expect(expected?.next[0]).toBe("2026-01-01T00:08:00.000Z");
  });

  it("a_dense_schedule_counts_its_missed_starts_over_its_latest_thousand_occurrences", async () => {
    await publish(
      t,
      editor,
      aScheduledDocument("dense", { every: { minutes: 1 } }),
    );
    await turnOn("dense");
    run.clock.advance("1499m");
    await pass("1m");

    const [expected] = await expectedSince("2025-12-31T00:00:00.000Z");

    expect(expected).toMatchObject({
      missed: 1_000,
      missedSince: "2026-01-01T08:20:00.000Z",
    });
  });

  it("a_daily_schedule_names_its_starts_of_the_next_seven_days", async () => {
    await publish(
      t,
      editor,
      aScheduledDocument("daily", { cron: "0 9 * * *" }),
    );
    await turnOn("daily");

    const [expected] = await expectedSince("2026-01-01T00:00:00.000Z");

    expect(expected?.next).toEqual([
      "2026-01-01T09:00:00.000Z",
      "2026-01-02T09:00:00.000Z",
      "2026-01-03T09:00:00.000Z",
      "2026-01-04T09:00:00.000Z",
      "2026-01-05T09:00:00.000Z",
      "2026-01-06T09:00:00.000Z",
      "2026-01-07T09:00:00.000Z",
    ]);
    expect(expected?.missed).toBe(0);
  });

  it("a_workflow_that_is_off_expects_no_starts", async () => {
    await publish(
      t,
      editor,
      aScheduledDocument("idle", { every: { minutes: 1 } }),
    );

    const expected = await expectedSince("2026-01-01T00:00:00.000Z");

    expect(expected).toEqual([]);
  });

  it("a_window_without_its_start_is_a_bad_request", async () => {
    await request(t.server)
      .get("/api/v1/expected-starts?from=yesterday")
      .set(viewer)
      .expect(400);
    await request(t.server)
      .get("/api/v1/expected-starts")
      .set(viewer)
      .expect(400);
  });
});
