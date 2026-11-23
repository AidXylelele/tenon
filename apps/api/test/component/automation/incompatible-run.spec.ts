import { sql } from "drizzle-orm";
import request from "supertest";
import { Role } from "../../../src/domain/identity/users/enums.js";
import { authHeaders, createUser, signIn } from "../../support/auth-helpers.js";
import { aDocument } from "../../support/builders.js";
import type { TestApp } from "../../support/create-test-app.js";
import {
  aWaitingDocument,
  createRunApp,
  drain,
  instanceOf,
  publish,
  type RunApp,
  relay,
  start,
  tasksOf,
} from "../../support/run-helpers.js";
import { truncateAll } from "../../support/db.js";

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
    await truncateAll(t.db);
    await createUser(t, { email: "editor@example.com", role: Role.Editor });
    editor = authHeaders(await signIn(t.server, "editor@example.com"));
    await publish(t, editor, aWaitingDocument({ name: "waiter" }));
  });

  async function ofAnotherBuild(id: string): Promise<string> {
    await drain(t);
    await t.db.execute(
      sql`update workflow_instance set program_fingerprint = 'a-program-of-another-build' where id = ${id}`,
    );
    return id;
  }

  async function waitingInstanceOfAnotherBuild(): Promise<string> {
    const started = await start(t, editor, { input: {} }, "sales/waiter");
    return ofAnotherBuild(started.id);
  }

  async function nextTurn(): Promise<void> {
    run.clock.advance("1h");
    await drain(t);
  }

  it("is_cancelled_at_its_next_turn_with_the_reason_and_may_be_restarted", async () => {
    const id = await waitingInstanceOfAnotherBuild();

    await drain(t);
    const beforeItsTurn = await instanceOf(t, editor, id);
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

    expect(beforeItsTurn.phase).toBe("waiting");
    expect(beforeItsTurn.cancelReason).toBeNull();
    expect(cancelled.phase).toBe("cancelled");
    expect(cancelled.cancelReason).toBe(INTERPRETER_CHANGED);
    expect(cancelled.error).toBeNull();
    expect(cancelled.endedAt).not.toBeNull();
    expect(cancelled.waits).toEqual([]);
    expect(cancelled.controls).toEqual(["restart", "delete"]);
    expect(told).toHaveLength(1);
  });

  it("is_cancelled_with_the_reason_when_it_is_suspended", async () => {
    const id = await waitingInstanceOfAnotherBuild();

    await request(t.server)
      .post(`/api/v1/instances/${id}/suspend`)
      .set(editor)
      .expect(204);
    await drain(t);
    const cancelled = await instanceOf(t, editor, id);

    expect(cancelled.phase).toBe("cancelled");
    expect(cancelled.cancelReason).toBe(INTERPRETER_CHANGED);
  });

  it("is_cancelled_with_the_reason_when_an_event_it_listens_for_arrives", async () => {
    const listening = aDocument({ name: "listener" }, [
      {
        awaitOrder: {
          listen: { to: { one: { with: { type: "order.placed" } } } },
        },
      },
    ]);
    await publish(t, editor, listening);
    const started = await start(t, editor, { input: {} }, "sales/listener");
    const id = await ofAnotherBuild(started.id);
    const placed = {
      specversion: "1.0",
      id: "order-1",
      source: "/shop",
      type: "order.placed",
      data: {},
    };

    await request(t.server)
      .post("/api/v1/events")
      .set(editor)
      .set("content-type", "application/cloudevents+json")
      .send(JSON.stringify(placed))
      .expect(202);
    await relay(t);
    await drain(t);
    const cancelled = await instanceOf(t, editor, id);

    expect(cancelled.phase).toBe("cancelled");
    expect(cancelled.cancelReason).toBe(INTERPRETER_CHANGED);
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
