import { sql } from "drizzle-orm";
import request from "supertest";
import { Role } from "../../../src/domain/identity/enums.js";
import { authHeaders, createUser, signIn } from "../../support/auth-helpers.js";
import type { TestApp } from "../../support/create-test-app.js";
import {
  aWaitingDocument,
  createRunApp,
  drain,
  instanceOf,
  publish,
  type RunApp,
  resetRuns,
  start,
  tasksOf,
} from "../../support/run-helpers.js";

const INTERPRETER_CHANGED = "the platform's interpreter changed";

describe("a run this build of the interpreter cannot continue", () => {
  let run: RunApp;
  let t: TestApp;
  let editor: Record<string, string>;

  beforeAll(async () => {
    run = await createRunApp();
    t = run.t;
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetRuns(t);
    await createUser(t, { email: "editor@example.com", role: Role.Editor });
    editor = authHeaders(await signIn(t.server, "editor@example.com"));
    await publish(t, editor, aWaitingDocument({ name: "waiter" }));
  });

  async function waitingInstanceOfAnotherBuild(): Promise<string> {
    const started = await start(t, editor, { input: {} }, "sales/waiter");
    await drain(t);
    await t.db.execute(
      sql`update workflow_instance set program_fingerprint = 'a-program-of-another-build' where id = ${started.id}`,
    );
    return started.id;
  }

  async function nextTurn(): Promise<void> {
    run.clock.advance("1h");
    await drain(t);
  }

  it("is_cancelled_at_its_next_turn_with_the_reason_and_may_be_restarted", async () => {
    const id = await waitingInstanceOfAnotherBuild();

    await nextTurn();
    const cancelled = await instanceOf(t, editor, id);
    const events = await request(t.server)
      .get(`/api/v1/instances/${id}/events?limit=200`)
      .set(editor)
      .expect(200);
    const types = (events.body as { items: { type: string }[] }).items.map(
      (event) => event.type,
    );
    const told = types.filter(
      (type) =>
        type === "org.open-workflow-specification.workflow.cancelled.v1",
    );

    expect(cancelled.phase).toBe("cancelled");
    expect(cancelled.cancelReason).toBe(INTERPRETER_CHANGED);
    expect(cancelled.error).toBeNull();
    expect(cancelled.endedAt).not.toBeNull();
    expect(cancelled.waits).toEqual([]);
    expect(cancelled.controls).toEqual(["restart", "delete"]);
    expect(told).toHaveLength(1);
  });

  it("leaves_the_task_it_waited_in_cancelled_not_running", async () => {
    const id = await waitingInstanceOfAnotherBuild();

    await nextTurn();
    const tasks = await tasksOf(t, editor, id);

    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.map((task) => task.status)).not.toContain("running");
    expect(tasks.every((task) => task.endedAt !== null)).toBe(true);
  });
});
