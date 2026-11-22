import { sql } from "drizzle-orm";
import request from "supertest";
import { Role } from "../../../src/domain/identity/enums.js";
import { StartUpJobs } from "../../../src/frameworks/schedule/start-up.jobs.js";
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

describe("the cut-over to another build of the interpreter", () => {
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

  async function waitingInstance(): Promise<string> {
    const started = await start(t, editor, { input: {} }, "sales/waiter");
    await drain(t);
    return started.id;
  }

  async function madeByAnotherBuild(id: string): Promise<void> {
    await t.db.execute(
      sql`update workflow_instance set program_fingerprint = 'a-program-of-another-build' where id = ${id}`,
    );
  }

  async function ofAnotherStateFormat(id: string): Promise<void> {
    await t.db.execute(
      sql`update workflow_instance set run_format = 0 where id = ${id}`,
    );
  }

  async function cutOver(): Promise<void> {
    await t.app.get(StartUpJobs).cutOver();
    await drain(t);
  }

  it("a_run_whose_program_this_build_does_not_rebuild_is_cancelled_with_the_reason_and_may_be_restarted", async () => {
    const id = await waitingInstance();
    await madeByAnotherBuild(id);

    await cutOver();
    const cancelled = await instanceOf(t, editor, id);

    expect(cancelled.phase).toBe("cancelled");
    expect(cancelled.cancelReason).toBe(INTERPRETER_CHANGED);
    expect(cancelled.error).toBeNull();
    expect(cancelled.endedAt).not.toBeNull();
    expect(cancelled.waits).toEqual([]);
    expect(cancelled.controls).toEqual(["restart", "delete"]);
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
    expect(told).toHaveLength(1);
  });

  it("the_task_a_cut_over_cancels_in_its_wait_reads_cancelled_not_running", async () => {
    const id = await waitingInstance();
    await madeByAnotherBuild(id);

    await cutOver();
    const tasks = await tasksOf(t, editor, id);

    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.map((task) => task.status)).not.toContain("running");
    expect(tasks.every((task) => task.endedAt !== null)).toBe(true);
  });

  it("a_run_whose_state_is_of_another_format_is_cancelled_the_same_way", async () => {
    const id = await waitingInstance();
    await ofAnotherStateFormat(id);

    await cutOver();
    const cancelled = await instanceOf(t, editor, id);

    expect(cancelled.phase).toBe("cancelled");
    expect(cancelled.cancelReason).toBe(INTERPRETER_CHANGED);
  });

  it("a_run_this_build_continues_is_left_waiting_and_completes", async () => {
    const id = await waitingInstance();

    await cutOver();
    const waiting = await instanceOf(t, editor, id);
    run.clock.advance("1h");
    await drain(t);
    const completed = await instanceOf(t, editor, id);

    expect(waiting.phase).toBe("waiting");
    expect(waiting.cancelReason).toBeNull();
    expect(completed.phase).toBe("completed");
  });

  it("a_stranded_run_that_its_timer_reaches_first_is_cancelled_by_the_same_rule_and_not_faulted", async () => {
    const id = await waitingInstance();
    await madeByAnotherBuild(id);

    run.clock.advance("1h");
    await drain(t);
    const cancelled = await instanceOf(t, editor, id);

    expect(cancelled.phase).toBe("cancelled");
    expect(cancelled.cancelReason).toBe(INTERPRETER_CHANGED);
    expect(cancelled.error).toBeNull();
  });
});
