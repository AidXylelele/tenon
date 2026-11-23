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
  namesOf,
  publish,
  relay,
  type RunApp,
  resetRuns,
  start,
  statusesOf,
  type TaskBody,
  tasksOf,
} from "../../support/run-helpers.js";
import { startStubServer, type StubServer } from "../../support/stub-server.js";
import type { Created, Page, Problem } from "../../support/bodies.js";

const PROBLEM = "application/problem+json";
const ERRORS = "https://open-workflow-specification.org/spec/1.0.0/errors/";
const STRUCTURED = "application/cloudevents+json";
interface RunPage {
  readonly items: { readonly id: string }[];
  readonly total: number;
  readonly exact: boolean;
}

const SUMMARY_KEYS = [
  "createdAt",
  "endedAt",
  "id",
  "name",
  "namespace",
  "phase",
  "startedAt",
  "test",
  "trigger",
  "version",
];

const LISTED_KEYS = [
  ...SUMMARY_KEYS,
  "durationMs",
  "startedBy",
  "waits",
].sort();

interface LifecycleEvent {
  readonly type: string;
  readonly data: { readonly task?: string };
}

const tasksIn = (events: readonly LifecycleEvent[], change: string) =>
  events
    .filter(
      (event) =>
        event.type === `org.open-workflow-specification.task.${change}.v1`,
    )
    .map((event) => event.data.task);

const aVersion = (version: string) =>
  aDocument({ version }, [{ greet: { set: { ranVersion: version } } }]);

describe("running a workflow and following its execution over HTTP", () => {
  let run: RunApp;
  let t: TestApp;
  let editor: Record<string, string>;
  let viewer: Record<string, string>;
  let editorId: string;
  let crm: StubServer;

  beforeAll(async () => {
    crm = await startStubServer((received, response) => {
      if (received.url === "/slow") return;

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: 1 }));
    });
    run = await createRunApp();
    t = run.t;
  });

  afterAll(async () => {
    await t.close();
    await crm.close();
  });

  beforeEach(async () => {
    await resetRuns(t);
    const author = await createUser(t, {
      email: "editor@example.com",
      role: Role.Editor,
    });
    editorId = author.id;
    await createUser(t, { email: "viewer@example.com", role: Role.Viewer });
    editor = authHeaders(await signIn(t.server, "editor@example.com"));
    viewer = authHeaders(await signIn(t.server, "viewer@example.com"));
  });

  describe("starting", () => {
    it("a_start_without_a_version_answers_a_pending_summary_of_the_current_version", async () => {
      await publish(t, editor, aVersion("1.0.0"));
      await publish(t, editor, aVersion("1.1.0"));

      const started = await request(t.server)
        .post("/api/v1/workflows/sales/route-lead/instances")
        .set(editor)
        .send({ input: { lead: "ada" } })
        .expect(201);
      await drain(t);
      const instance = await instanceOf(
        t,
        viewer,
        (started.body as Created).id,
      );

      expect(Object.keys(started.body as object).sort()).toEqual(SUMMARY_KEYS);
      expect(started.body).toMatchObject({
        namespace: "sales",
        name: "route-lead",
        version: "1.1.0",
        phase: "pending",
        trigger: "manual",
        startedAt: null,
        endedAt: null,
      });
      expect(instance).toMatchObject({
        phase: "completed",
        version: "1.1.0",
        output: { ranVersion: "1.1.0" },
      });
    });

    it("a_start_of_a_named_version_runs_that_version_and_not_the_current_one", async () => {
      await publish(t, editor, aVersion("1.0.0"));
      await publish(t, editor, aVersion("1.1.0"));

      const started = await start(t, editor, { version: "1.0.0", input: {} });
      await drain(t);
      const instance = await instanceOf(t, viewer, started.id);

      expect(started.body.version).toBe("1.0.0");
      expect(instance).toMatchObject({
        phase: "completed",
        version: "1.0.0",
        output: { ranVersion: "1.0.0" },
      });
    });

    it("a_start_of_the_version_latest_runs_the_current_version", async () => {
      await publish(t, editor, aVersion("1.0.0"));
      await publish(t, editor, aVersion("1.1.0"));

      const started = await request(t.server)
        .post("/api/v1/workflows/sales/route-lead/instances")
        .set(editor)
        .send({ version: "latest", input: {} });

      expect(started.status).toBe(201);
      expect(started.body).toMatchObject({ version: "1.1.0" });
    });

    it("an_omitted_input_starts_with_an_empty_object", async () => {
      await publish(t, editor, aDocument());

      const started = await start(t, editor, {});
      const instance = await instanceOf(t, viewer, started.id);

      expect(instance.input).toEqual({});
    });

    it("any_json_value_is_an_input", async () => {
      await publish(t, editor, aDocument());

      const list = await start(t, editor, { input: [1, "two", null] });
      const text = await start(t, editor, { input: "plain" });

      expect((await instanceOf(t, viewer, list.id)).input).toEqual([
        1,
        "two",
        null,
      ]);
      expect((await instanceOf(t, viewer, text.id)).input).toBe("plain");
    });

    it("an_unknown_workflow_is_not_found", async () => {
      const missing = await request(t.server)
        .post("/api/v1/workflows/sales/missing/instances")
        .set(editor)
        .send({ input: {} })
        .expect(404);

      expect(missing.headers["content-type"]).toContain(PROBLEM);
      expect(missing.body).toMatchObject({
        type: "urn:problem:workflow.not-found",
        status: 404,
      });
    });

    it("an_unpublished_version_is_not_found_and_starts_nothing", async () => {
      await publish(t, editor, aDocument());

      const missing = await request(t.server)
        .post("/api/v1/workflows/sales/route-lead/instances")
        .set(editor)
        .send({ version: "9.9.9", input: {} })
        .expect(404);
      const list = await request(t.server)
        .get("/api/v1/instances")
        .set(viewer)
        .expect(200);

      expect(missing.headers["content-type"]).toContain(PROBLEM);
      expect(missing.body).toMatchObject({
        type: "urn:problem:version.not-found",
        status: 404,
      });
      expect((list.body as Page<unknown>).items).toEqual([]);
    });

    it("an_archived_workflow_starts_no_instance", async () => {
      await publish(t, editor, aDocument());
      await request(t.server)
        .post("/api/v1/workflows/sales/route-lead/archive")
        .set(editor)
        .expect(204);

      const refused = await request(t.server)
        .post("/api/v1/workflows/sales/route-lead/instances")
        .set(editor)
        .send({ input: {} })
        .expect(409);
      const named = await request(t.server)
        .post("/api/v1/workflows/sales/route-lead/instances")
        .set(editor)
        .send({ version: "1.0.0", input: {} })
        .expect(409);

      expect(refused.headers["content-type"]).toContain(PROBLEM);
      expect(refused.body).toMatchObject({
        type: "urn:problem:workflow.archived",
        status: 409,
      });
      expect((named.body as Problem).type).toBe(
        "urn:problem:workflow.archived",
      );
    });

    it("a_malformed_start_body_is_a_bad_request", async () => {
      await publish(t, editor, aDocument());
      const url = "/api/v1/workflows/sales/route-lead/instances";

      await request(t.server)
        .post(url)
        .set(editor)
        .send({ input: {}, extra: true })
        .expect(400);
      await request(t.server)
        .post(url)
        .set(editor)
        .send({ version: 1, input: {} })
        .expect(400);
      await request(t.server).post(url).set(editor).send([1, 2]).expect(400);
      await request(t.server)
        .post(url)
        .set(editor)
        .type("text/plain")
        .send("hello")
        .expect(415);
      const list = await request(t.server)
        .get("/api/v1/instances")
        .set(viewer)
        .expect(200);

      expect((list.body as Page<unknown>).items).toEqual([]);
    });

    it("an_empty_version_is_a_bad_request", async () => {
      await publish(t, editor, aDocument());

      await request(t.server)
        .post("/api/v1/workflows/sales/route-lead/instances")
        .set(editor)
        .send({ version: "", input: {} })
        .expect(400);
    });

    it("an_input_its_schema_refuses_is_answered_field_by_field_and_starts_no_run", async () => {
      const schema = {
        type: "object",
        required: ["customer"],
        properties: {
          customer: { type: "string" },
          count: { type: "integer", minimum: 1 },
        },
      };
      await publish(t, editor, {
        ...aDocument(),
        input: { schema: { format: "json", document: schema } },
      });

      const refused = await request(t.server)
        .post("/api/v1/workflows/sales/route-lead/instances")
        .set(editor)
        .send({ input: { count: 0 } })
        .expect(422);
      const list = await request(t.server)
        .get("/api/v1/instances")
        .set(viewer)
        .expect(200);

      expect(refused.body).toEqual({
        type: "urn:problem:instance.input-invalid",
        title: "Input refused",
        status: 422,
        detail: "The input does not match the workflow's input schema",
        errors: [
          { pointer: "/input/customer", detail: "Customer is required." },
          { pointer: "/input/count", detail: "Count must be at least 1." },
        ],
      });
      expect((list.body as Page<unknown>).items).toEqual([]);
    });
  });

  describe("idempotency", () => {
    it("a_repeated_start_with_the_same_key_answers_the_same_instance_and_starts_one", async () => {
      await publish(t, editor, aDocument());
      const url = "/api/v1/workflows/sales/route-lead/instances";

      const first = await request(t.server)
        .post(url)
        .set(editor)
        .set("Idempotency-Key", "start-1")
        .send({ input: { lead: "ada" } })
        .expect(201);
      const again = await request(t.server)
        .post(url)
        .set(editor)
        .set("Idempotency-Key", "start-1")
        .send({ input: { lead: "ada" } })
        .expect(201);
      const list = await request(t.server)
        .get("/api/v1/instances")
        .set(viewer)
        .expect(200);

      expect(again.body).toEqual(first.body);
      expect((list.body as Page<unknown>).items).toHaveLength(1);
    });

    it("the_same_key_with_another_input_or_version_is_refused_and_starts_nothing", async () => {
      await publish(t, editor, aVersion("1.0.0"));
      await publish(t, editor, aVersion("1.1.0"));
      const url = "/api/v1/workflows/sales/route-lead/instances";
      await request(t.server)
        .post(url)
        .set(editor)
        .set("Idempotency-Key", "start-2")
        .send({ input: { lead: "ada" } })
        .expect(201);

      const otherInput = await request(t.server)
        .post(url)
        .set(editor)
        .set("Idempotency-Key", "start-2")
        .send({ input: { lead: "bob" } });
      const otherVersion = await request(t.server)
        .post(url)
        .set(editor)
        .set("Idempotency-Key", "start-2")
        .send({ version: "1.0.0", input: { lead: "ada" } });
      const list = await request(t.server)
        .get("/api/v1/instances")
        .set(viewer)
        .expect(200);

      expect(otherInput.status).toBe(422);
      expect(otherVersion.status).toBe(422);
      expect((list.body as Page<unknown>).items).toHaveLength(1);
    });

    it("an_omitted_input_and_an_empty_object_are_the_same_request_under_one_key", async () => {
      await publish(t, editor, aDocument());
      const url = "/api/v1/workflows/sales/route-lead/instances";
      const first = await request(t.server)
        .post(url)
        .set(editor)
        .set("Idempotency-Key", "start-3")
        .send({})
        .expect(201);

      const again = await request(t.server)
        .post(url)
        .set(editor)
        .set("Idempotency-Key", "start-3")
        .send({ input: {} });

      expect(again.status).toBe(201);
      expect((again.body as Created).id).toBe((first.body as Created).id);
    });

    it("concurrent_starts_with_the_same_key_create_one_instance", async () => {
      await publish(t, editor, aDocument());
      const url = "/api/v1/workflows/sales/route-lead/instances";
      const attempts = Array.from({ length: 8 }, () =>
        request(t.server)
          .post(url)
          .set(editor)
          .set("Idempotency-Key", "start-concurrent")
          .send({ input: { lead: "ada" } })
          .then((response) => response),
      );

      const responses = await Promise.all(attempts);
      const list = await request(t.server)
        .get("/api/v1/instances")
        .set(viewer)
        .expect(200);
      const created = responses.filter((response) => response.status === 201);
      const ids = new Set(
        created.map((response) => (response.body as Created).id),
      );

      expect(
        responses.every((response) => [201, 409].includes(response.status)),
      ).toBe(true);
      expect(ids.size).toBe(1);
      expect((list.body as Page<unknown>).items).toHaveLength(1);
    });

    it("a_start_refused_as_not_found_answers_the_same_under_its_key", async () => {
      const url = "/api/v1/workflows/sales/route-lead/instances";
      await request(t.server)
        .post(url)
        .set(editor)
        .set("Idempotency-Key", "start-early")
        .send({ input: {} })
        .expect(404);
      await publish(t, editor, aDocument());

      const retried = await request(t.server)
        .post(url)
        .set(editor)
        .set("Idempotency-Key", "start-early")
        .send({ input: {} });
      const fresh = await request(t.server)
        .post(url)
        .set(editor)
        .set("Idempotency-Key", "start-later")
        .send({ input: {} });

      expect(retried.status).toBe(404);
      expect(fresh.status).toBe(201);
    });

    it("a_malformed_key_is_a_bad_request", async () => {
      await publish(t, editor, aDocument());

      await request(t.server)
        .post("/api/v1/workflows/sales/route-lead/instances")
        .set(editor)
        .set("Idempotency-Key", "x".repeat(300))
        .send({ input: {} })
        .expect(400);
    });
  });

  describe("following a run", () => {
    it("a_run_completes_with_its_output_and_its_task_records_in_start_order", async () => {
      const document = aDocument({}, [
        { first: { set: { a: 1 } } },
        { skipped: { if: "${ false }", set: { never: true } } },
        { second: { set: { a: "${ .a }", b: 2 } } },
      ]);
      await publish(t, editor, document);

      const started = await start(t, editor, { input: { lead: "ada" } });
      const pending = await instanceOf(t, viewer, started.id);
      await drain(t);
      const instance = await instanceOf(t, viewer, started.id);
      const tasks = await tasksOf(t, viewer, started.id);

      expect(pending.phase).toBe("pending");
      expect(instance).toMatchObject({
        phase: "completed",
        trigger: "manual",
        input: { lead: "ada" },
        output: { a: 1, b: 2 },
        error: null,
        originId: null,
        startedBy: { id: editorId },
        controls: ["restart", "delete"],
        waits: [],
        cancelReason: null,
      });
      expect(instance.startedAt).not.toBeNull();
      expect(instance.endedAt).not.toBeNull();
      expect(statusesOf(tasks)).toEqual([
        "first:completed",
        "skipped:skipped",
        "second:completed",
      ]);
      expect(tasks.map((task) => task.reference)).toEqual([
        "/do/0/first",
        "/do/1/skipped",
        "/do/2/second",
      ]);
      expect(tasks.every((task) => task.endedAt !== null)).toBe(true);
      expect(tasks[0]).toMatchObject({
        execution: "/do/0/first",
        error: null,
        attempt: 1,
        input: { lead: "ada" },
        output: { a: 1 },
        retryAt: null,
      });
      expect(tasks[1]).toMatchObject({ input: null, output: { a: 1 } });
      expect(tasks[2]).toMatchObject({
        input: { a: 1 },
        output: { a: 1, b: 2 },
      });
    });

    it("a_retried_task_counts_its_attempts_and_each_attempt_of_its_body_is_its_own_record", async () => {
      const flaky = { type: "https://example.com/errors/flaky", status: 503 };
      await publish(
        t,
        editor,
        aDocument({}, [
          {
            guarded: {
              try: [{ fail: { raise: { error: flaky } } }],
              catch: {
                errors: { with: { status: 503 } },
                retry: {
                  delay: { seconds: 1 },
                  limit: { attempt: { count: 2 } },
                },
              },
            },
          },
        ]),
      );

      const { id } = await start(t, editor);
      await drain(t);
      const waiting = await tasksOf(t, viewer, id);
      run.clock.advance("1s");
      await drain(t);
      run.clock.advance("1s");
      await drain(t);
      const tasks = await tasksOf(t, viewer, id);
      const guarded = tasks.find((task) => task.name === "guarded");
      const attempts = tasks.filter((task) => task.name === "fail");

      expect(statusesOf(waiting)).toEqual(["guarded:running", "fail:faulted"]);
      expect(waiting[0]?.attempt).toBe(2);
      expect(waiting[0]?.retryAt).toBe("2026-01-01T00:00:01.000Z");
      expect(guarded).toMatchObject({
        status: "faulted",
        attempt: 3,
        error: { status: 503 },
        retryAt: null,
      });
      expect(attempts.map((task) => task.status)).toEqual([
        "faulted",
        "faulted",
        "faulted",
      ]);
      expect(new Set(attempts.map((task) => task.execution)).size).toBe(3);
    });

    it("task_records_lie_within_their_instance_run", async () => {
      await publish(t, editor, aDocument());

      const started = await start(t, editor);
      await drain(t);
      const instance = await instanceOf(t, viewer, started.id);
      const [task] = await tasksOf(t, viewer, started.id);
      const begun = Date.parse(String(instance.startedAt));
      const ended = Date.parse(String(instance.endedAt));

      expect(Date.parse(String(task?.startedAt))).toBeGreaterThanOrEqual(begun);
      expect(Date.parse(String(task?.endedAt))).toBeLessThanOrEqual(ended);
    });

    it("task_records_page_in_start_order", async () => {
      const document = aDocument({}, [
        { one: { set: { n: 1 } } },
        { two: { set: { n: 2 } } },
        { three: { set: { n: 3 } } },
      ]);
      await publish(t, editor, document);
      const started = await start(t, editor);
      await drain(t);
      const url = `/api/v1/instances/${started.id}/tasks`;

      const first = await request(t.server)
        .get(`${url}?limit=2`)
        .set(viewer)
        .expect(200);
      const second = await request(t.server)
        .get(
          `${url}?limit=2&cursor=${String((first.body as Page<unknown>).next)}`,
        )
        .set(viewer)
        .expect(200);

      expect(namesOf((first.body as Page<TaskBody>).items)).toEqual([
        "one",
        "two",
      ]);
      expect(namesOf((second.body as Page<TaskBody>).items)).toEqual(["three"]);
      expect((second.body as Page<unknown>).next).toBeNull();
      await request(t.server).get(`${url}?limit=0`).set(viewer).expect(400);
      await request(t.server).get(`${url}?limit=501`).set(viewer).expect(400);
      await request(t.server).get(`${url}?cursor=abc`).set(viewer).expect(400);
    });

    it("an_unknown_or_malformed_instance_id_is_answered_as_such", async () => {
      const unknown = "00000000-0000-4000-8000-000000000000";

      const missing = await request(t.server)
        .get(`/api/v1/instances/${unknown}`)
        .set(viewer)
        .expect(404);
      await request(t.server)
        .get(`/api/v1/instances/${unknown}/tasks`)
        .set(viewer)
        .expect(404);
      await request(t.server)
        .get("/api/v1/instances/not-a-uuid")
        .set(viewer)
        .expect(400);

      expect(missing.headers["content-type"]).toContain(PROBLEM);
      expect(missing.body).toMatchObject({
        type: "urn:problem:instance.not-found",
        status: 404,
      });
    });

    it("a_simple_run_takes_little_wall_time", async () => {
      await publish(t, editor, aDocument());
      const runs = 10;
      const times: number[] = [];

      for (let index = 0; index < runs; index += 1) {
        const begun = performance.now();
        const started = await start(t, editor);
        await drain(t);
        const instance = await instanceOf(t, viewer, started.id);
        const elapsed = performance.now() - begun;
        times.push(elapsed);
        expect(instance.phase).toBe("completed");
      }

      const sorted = times.slice().sort((a, b) => a - b);
      const mean = times.reduce((sum, time) => sum + time, 0) / runs;
      const median = sorted[Math.floor(runs / 2)] ?? 0;
      const max = sorted.at(-1) ?? 0;
      console.info(
        `[wall time] simple run (start + drain + read), ${String(runs)} runs: mean ${mean.toFixed(1)} ms, median ${median.toFixed(1)} ms, max ${max.toFixed(1)} ms`,
      );
      expect(median).toBeLessThan(2_000);
    });
  });

  describe("driving a run", () => {
    async function eventsOf(id: string): Promise<LifecycleEvent[]> {
      const response = await request(t.server)
        .get(`/api/v1/instances/${id}/events?limit=200`)
        .set(viewer)
        .expect(200);
      return (response.body as Page<LifecycleEvent>).items;
    }

    it("a_completed_task_keeps_its_output_behind_the_output_uri_of_its_event", async () => {
      const unavailable = {
        type: "https://example.com/errors/unavailable",
        status: 503,
      };
      await publish(
        t,
        editor,
        aDocument({}, [
          { first: { set: { a: 1 } } },
          { broken: { raise: { error: unavailable } } },
        ]),
      );

      const { id } = await start(t, editor);
      await drain(t);
      const events = await eventsOf(id);
      const completed = events.find(
        (event) =>
          event.type === "org.open-workflow-specification.task.completed.v1",
      );
      const outputUri = (completed?.data as { outputUri?: string }).outputUri;
      const claimed = new URL(outputUri ?? "");
      const output = await request(t.server)
        .get(claimed.pathname)
        .set(viewer)
        .expect(200);
      const faulted = await request(t.server)
        .get(
          `/api/v1/instances/${id}/tasks/${encodeURIComponent("/do/1/broken")}/output`,
        )
        .set(viewer)
        .expect(404);

      expect(outputUri).toBe(
        `http://127.0.0.1:3000/api/v1/instances/${id}/tasks/%2Fdo%2F0%2Ffirst/output`,
      );
      expect(output.headers["content-type"]).toMatch(/^application\/json/);
      expect(output.body).toEqual({ a: 1 });
      expect(faulted.body).toMatchObject({
        status: 404,
        title: "Output not kept",
        detail: "The task has no output kept",
      });
    });

    it("each_iteration_of_a_for_stores_its_own_task_started_event", async () => {
      await publish(
        t,
        editor,
        aDocument({}, [
          {
            each: {
              for: { each: "item", in: "${ [1, 2, 3] }" },
              do: [{ note: { set: { seen: "${ $item }" } } }],
            },
          },
        ]),
      );
      const started = await start(t, editor);
      await drain(t);

      const events = await eventsOf(started.id);

      const notes = events.filter(
        (event) =>
          event.type === "org.open-workflow-specification.task.started.v1" &&
          event.data.task === "/do/0/each/do/0/note",
      );
      expect(notes).toHaveLength(3);
    });

    it("a_run_calling_waiting_emitting_listening_and_running_a_sub_workflow_completes_with_its_records_and_events", async () => {
      await publish(
        t,
        editor,
        aDocument({ name: "child" }, [{ mark: { set: { child: true } } }]),
      );
      await publish(
        t,
        editor,
        aDocument({}, [
          {
            fetch: {
              call: "http",
              with: {
                method: "get",
                endpoint: `${crm.origin}/leads/1`,
              },
            },
          },
          { pause: { wait: { minutes: 1 } } },
          {
            announce: {
              emit: {
                event: {
                  with: {
                    source: "https://shop.example.com",
                    type: "com.example.lead.routed",
                  },
                },
              },
            },
          },
          {
            confirm: {
              listen: {
                to: { one: { with: { type: "com.example.lead.confirmed" } } },
              },
            },
          },
          {
            delegate: {
              run: {
                workflow: {
                  namespace: "sales",
                  name: "child",
                  version: "1.0.0",
                },
              },
            },
          },
        ]),
      );

      const { id } = await start(t, editor);
      await drain(t);
      const paused = await instanceOf(t, viewer, id);
      run.clock.advance("1m");
      await drain(t);
      const listening = await instanceOf(t, viewer, id);
      await request(t.server)
        .post("/api/v1/events")
        .set(editor)
        .set("content-type", STRUCTURED)
        .send(
          JSON.stringify({
            specversion: "1.0",
            id: "confirmation-1",
            source: "/crm",
            type: "com.example.lead.confirmed",
          }),
        )
        .expect(202);
      await relay(t);
      await drain(t);
      const done = await instanceOf(t, viewer, id);
      const tasks = await tasksOf(t, viewer, id);
      const events = await eventsOf(id);
      const types = events.map((event) => event.type);

      expect(paused.phase).toBe("waiting");
      expect(listening.phase).toBe("waiting");
      expect(done.phase).toBe("completed");
      expect(done.output).toEqual({ child: true });
      expect(statusesOf(tasks)).toEqual([
        "fetch:completed",
        "pause:completed",
        "announce:completed",
        "confirm:completed",
        "delegate:completed",
      ]);
      expect(tasksIn(events, "completed")).toEqual([
        "/do/0/fetch",
        "/do/1/pause",
        "/do/2/announce",
        "/do/3/confirm",
        "/do/4/delegate",
      ]);
      expect(types).toContain(
        "org.open-workflow-specification.workflow.completed.v1",
      );
      expect(types).toContain("io.serverlessworkflow.workflow.completed.v1");
    });

    it("a_call_hanging_past_its_deadline_faults_the_run_with_the_standards_timeout_error", async () => {
      await publish(
        t,
        editor,
        aDocument({}, [
          {
            slow: {
              call: "http",
              with: { method: "get", endpoint: `${crm.origin}/slow` },
              timeout: { after: { seconds: 1 } },
            },
          },
        ]),
      );
      run.clock.set(Date.now());

      const { id } = await start(t, editor);
      await drain(t);
      const instance = await instanceOf(t, viewer, id);

      expect(instance.phase).toBe("faulted");
      expect(instance.error).toMatchObject({
        type: `${ERRORS}timeout`,
        status: 408,
        instance: "/do/0/slow",
      });
    });

    it("a_wait_longer_than_its_deadline_faults_the_run_with_the_standards_timeout_when_the_deadline_passes", async () => {
      await publish(
        t,
        editor,
        aDocument({}, [
          {
            pause: {
              wait: { hours: 1 },
              timeout: { after: { minutes: 1 } },
            },
          },
        ]),
      );

      const { id } = await start(t, editor);
      await drain(t);
      run.clock.advance("1m");
      await drain(t);
      const instance = await instanceOf(t, viewer, id);

      expect(instance.phase).toBe("faulted");
      expect(instance.error).toMatchObject({
        type: `${ERRORS}timeout`,
        status: 408,
        instance: "/do/0/pause",
      });
    });

    it("the_task_after_a_wait_starts_when_the_wait_ended", async () => {
      await publish(t, editor, aWaitingDocument());

      const { id } = await start(t, editor);
      await drain(t);
      run.clock.advance("1h");
      await drain(t);
      const instance = await instanceOf(t, viewer, id);
      const tasks = await tasksOf(t, viewer, id);
      const begun = Date.parse(String(instance.startedAt));
      const after = tasks.find((task) => task.name === "after");
      const waited = Date.parse(String(after?.startedAt)) - begun;

      expect(instance.phase).toBe("completed");
      expect(waited).toBe(3_600_000);
    });

    it("a_runaway_expression_faults_its_instance_as_a_platform_failure_and_the_next_run_completes", async () => {
      await publish(
        t,
        editor,
        aDocument({ name: "spinner" }, [
          { spin: { set: { x: "${ def f: f; f }" } } },
        ]),
      );
      await publish(t, editor, aDocument());

      const stuck = await start(t, editor, { input: {} }, "sales/spinner");
      await drain(t);
      const next = await start(t, editor);
      await drain(t);
      const faulted = await instanceOf(t, viewer, stuck.id);
      const completed = await instanceOf(t, viewer, next.id);

      expect(faulted.phase).toBe("faulted");
      expect(faulted.error).toMatchObject({
        type: `${ERRORS}runtime`,
        status: 500,
      });
      expect(completed.phase).toBe("completed");
    });

    it("a_platform_failure_faults_the_running_tasks_and_tells_workflow_faulted_once", async () => {
      await publish(
        t,
        editor,
        aDocument({ name: "nested-spinner" }, [
          {
            outer: {
              do: [
                { pause: { wait: { seconds: 1 } } },
                { spin: { set: { x: "${ def f: f; f }" } } },
              ],
            },
          },
        ]),
      );

      const { id } = await start(
        t,
        editor,
        { input: {} },
        "sales/nested-spinner",
      );
      await drain(t);
      run.clock.advance("1s");
      await drain(t);
      const instance = await instanceOf(t, viewer, id);
      const tasks = await tasksOf(t, viewer, id);
      const events = await eventsOf(id);
      const faults = events.filter(
        (event) =>
          event.type === "org.open-workflow-specification.workflow.faulted.v1",
      );

      expect(instance.phase).toBe("faulted");
      expect(instance.error).toEqual({
        type: `${ERRORS}runtime`,
        status: 500,
        title: "Runtime Error",
        detail: "The platform could not run the instance",
        instance: "",
      });
      expect(statusesOf(tasks)).toEqual(["outer:faulted", "pause:faulted"]);
      expect(faults).toHaveLength(1);
    });
  });

  describe("listing", () => {
    async function seed(): Promise<Record<string, string>> {
      await publish(t, editor, aDocument({ name: "alpha" }));
      await publish(t, editor, aDocument({ name: "beta" }));
      await publish(t, editor, aDocument({ namespace: "ops", name: "alpha" }));
      const a1 = await start(t, editor, { input: {} }, "sales/alpha");
      await drain(t);
      run.clock.advance("1s");
      const a2 = await start(t, editor, { input: {} }, "sales/alpha");
      run.clock.advance("1s");
      const b1 = await start(t, editor, { input: {} }, "sales/beta");
      run.clock.advance("1s");
      const o1 = await start(t, editor, { input: {} }, "ops/alpha");
      return { a1: a1.id, a2: a2.id, b1: b1.id, o1: o1.id };
    }

    const idsOf = (body: { items: { id: string }[] }) =>
      body.items.map((item) => item.id);

    it("instances_list_by_newest_start_page_by_page_with_the_total", async () => {
      const ids = await seed();

      const first = await request(t.server)
        .get("/api/v1/instances?limit=3")
        .set(viewer)
        .expect(200);
      const second = await request(t.server)
        .get("/api/v1/instances?limit=3&page=2")
        .set(viewer)
        .expect(200);

      const firstPage = first.body as RunPage;
      const secondPage = second.body as RunPage;
      expect(idsOf(firstPage)).toEqual([ids.o1, ids.b1, ids.a2]);
      expect(idsOf(secondPage)).toEqual([ids.a1]);
      expect(firstPage.total).toBe(4);
      expect(firstPage.exact).toBe(true);
      expect(secondPage.total).toBe(4);
      const [summary] = firstPage.items;
      const keys = Object.keys(summary ?? {}).sort();
      expect(keys).toEqual(LISTED_KEYS);
      expect(secondPage.items[0]).toMatchObject({
        startedBy: { id: editorId },
        durationMs: 0,
        waits: [],
      });
    });

    it("instances_with_one_creation_time_still_page_without_loss_or_repeat", async () => {
      await publish(t, editor, aDocument());
      const started: string[] = [];

      for (let index = 0; index < 5; index += 1)
        started.push((await start(t, editor)).id);

      const pages = ["1", "2", "3"];
      const seen: string[] = [];

      for (const page of pages) {
        const response = await request(t.server)
          .get(`/api/v1/instances?limit=2&page=${page}`)
          .set(viewer)
          .expect(200);
        seen.push(...idsOf(response.body as RunPage));
      }

      expect(seen.slice().sort()).toEqual(started.slice().sort());
    });

    it("instances_filter_by_namespace_name_and_one_or_several_phases", async () => {
      const ids = await seed();
      const list = async (query: string) => {
        const response = await request(t.server)
          .get(`/api/v1/instances?${query}`)
          .set(viewer)
          .expect(200);
        return idsOf(response.body as RunPage);
      };

      expect(await list("name=alpha")).toEqual([ids.o1, ids.a2, ids.a1]);
      expect(await list("namespace=sales")).toEqual([ids.b1, ids.a2, ids.a1]);
      expect(await list("namespace=sales&name=alpha")).toEqual([
        ids.a2,
        ids.a1,
      ]);
      expect(await list("phase=completed")).toEqual([ids.a1]);
      expect(await list("phase=pending&name=alpha")).toEqual([ids.o1, ids.a2]);
      expect(
        await list("phase=pending&phase=completed&namespace=sales"),
      ).toEqual([ids.b1, ids.a2, ids.a1]);
      expect(await list("namespace=none")).toEqual([]);
    });

    it.each([
      ["an unknown phase", "phase=sleeping"],
      ["a limit of none", "limit=0"],
      ["a limit over a hundred", "limit=101"],
      ["a limit in words", "limit=ten"],
      ["page zero", "page=0"],
      ["an unknown order", "sort=name"],
      ["a cursor", "cursor=garbage"],
      ["a start in words", "from=yesterday"],
      ["an unknown field", "unknown=1"],
    ])("a_list_with_%s_is_a_bad_request", async (_case, query) => {
      await request(t.server)
        .get(`/api/v1/instances?${query}`)
        .set(viewer)
        .expect(400);
    });

    it("instances_filter_by_version_and_a_start_window_and_sort_by_duration", async () => {
      await publish(t, editor, aVersion("1.0.0"));
      const started = await start(t, editor);
      await drain(t);
      const now = Date.now();
      const aSecondBefore = new Date(now - 1_000).toISOString();
      const justAfter = new Date(now + 1).toISOString();
      const startTime = new Date(now).toISOString();
      const window = `from=${aSecondBefore}&to=${justAfter}&sort=duration`;

      const byVersion = await request(t.server)
        .get("/api/v1/instances?version=1.0.0")
        .set(viewer)
        .expect(200);
      const inWindow = await request(t.server)
        .get(`/api/v1/instances?${window}`)
        .set(viewer)
        .expect(200);
      const before = await request(t.server)
        .get(`/api/v1/instances?to=${startTime}`)
        .set(viewer)
        .expect(200);

      expect(idsOf(byVersion.body as RunPage)).toEqual([started.id]);
      expect(idsOf(inWindow.body as RunPage)).toEqual([started.id]);
      expect(idsOf(before.body as RunPage)).toEqual([]);
    });
  });

  describe("access", () => {
    it("a_viewer_reads_instances_but_starts_and_controls_none", async () => {
      await publish(t, editor, aDocument());
      const started = await start(t, editor);
      await drain(t);
      const id = started.id;

      await request(t.server).get("/api/v1/instances").set(viewer).expect(200);
      await request(t.server)
        .get(`/api/v1/instances/${id}`)
        .set(viewer)
        .expect(200);
      await request(t.server)
        .get(`/api/v1/instances/${id}/tasks`)
        .set(viewer)
        .expect(200);
      await request(t.server)
        .post("/api/v1/workflows/sales/route-lead/instances")
        .set(viewer)
        .send({ input: {} })
        .expect(403);

      for (const action of ["cancel", "suspend", "resume", "restart"])
        await request(t.server)
          .post(`/api/v1/instances/${id}/${action}`)
          .set(viewer)
          .expect(403);

      await request(t.server)
        .delete(`/api/v1/instances/${id}`)
        .set(viewer)
        .expect(403);
      const instance = await instanceOf(t, viewer, id);
      const list = await request(t.server)
        .get("/api/v1/instances")
        .set(viewer)
        .expect(200);

      expect(instance.phase).toBe("completed");
      expect((list.body as Page<unknown>).items).toHaveLength(1);
    });

    it("an_administrator_starts_and_controls_instances", async () => {
      await createUser(t, { email: "admin@example.com", role: Role.Admin });
      const admin = authHeaders(await signIn(t.server, "admin@example.com"));
      await publish(t, editor, aDocument());

      const started = await start(t, admin);
      await request(t.server)
        .post(`/api/v1/instances/${started.id}/cancel`)
        .set(admin)
        .expect(204);
    });

    it("without_a_session_nothing_is_answered", async () => {
      await publish(t, editor, aDocument());
      const started = await start(t, editor);
      const id = started.id;

      await request(t.server).get("/api/v1/instances").expect(401);
      await request(t.server).get(`/api/v1/instances/${id}`).expect(401);
      await request(t.server).get(`/api/v1/instances/${id}/tasks`).expect(401);
      await request(t.server)
        .post("/api/v1/workflows/sales/route-lead/instances")
        .send({ input: {} })
        .expect(401);

      for (const action of ["cancel", "suspend", "resume", "restart"])
        await request(t.server)
          .post(`/api/v1/instances/${id}/${action}`)
          .expect(401);

      await request(t.server).delete(`/api/v1/instances/${id}`).expect(401);
      const instance = await instanceOf(t, viewer, id);

      expect(instance.phase).toBe("pending");
    });
  });
});
