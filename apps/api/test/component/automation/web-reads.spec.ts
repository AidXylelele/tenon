import request from "supertest";
import type { JsonObject } from "../../../src/domain/automation/interfaces.js";
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
  resetRuns,
  type RunApp,
  start,
} from "../../support/run-helpers.js";

interface WorkflowItem {
  readonly name: string;
  readonly schedule: unknown;
  readonly week: { readonly runs: number; readonly failed: number };
  readonly lastRun: { readonly id: string; readonly phase: string } | null;
}

describe("the reads the web console asks for", () => {
  let run: RunApp;
  let t: TestApp;
  let editor: Record<string, string>;
  let viewer: Record<string, string>;
  let editorId: string;

  beforeAll(async () => {
    run = await createRunApp();
    t = run.t;
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetRuns(t);
    const author = await createUser(t, {
      email: "editor@example.com",
      role: Role.Editor,
      name: "Ada",
    });
    editorId = author.id;
    await createUser(t, { email: "viewer@example.com", role: Role.Viewer });
    editor = authHeaders(await signIn(t.server, "editor@example.com"));
    viewer = authHeaders(await signIn(t.server, "viewer@example.com"));
  });

  it("the_session_names_what_the_person_may_do", async () => {
    const author = await request(t.server)
      .get("/api/v1/auth/session")
      .set(editor)
      .expect(200);
    const reader = await request(t.server)
      .get("/api/v1/auth/session")
      .set(viewer)
      .expect(200);

    expect(author.body).toMatchObject({
      capabilities: { author: true, operator: true, administrator: false },
    });
    expect(reader.body).toMatchObject({
      capabilities: { author: false, operator: false, administrator: false },
    });
  });

  it("the_workflow_list_carries_the_schedule_the_runs_of_the_week_and_the_last_run_and_searches_by_name", async () => {
    await publish(t, editor, {
      ...aDocument(),
      schedule: { every: { minutes: 5 } },
    });
    await publish(t, editor, aDocument({ name: "other-flow" }));
    const started = await start(t, editor);
    await drain(t);

    const listed = await request(t.server)
      .get("/api/v1/workflows?q=route")
      .set(viewer)
      .expect(200);
    const versions = await request(t.server)
      .get("/api/v1/workflows/sales/route-lead/versions")
      .set(viewer)
      .expect(200);

    const items = (listed.body as { items: WorkflowItem[] }).items;
    expect(items).toEqual([
      expect.objectContaining({
        name: "route-lead",
        schedule: { kind: "every", interval: 300_000 },
        week: { runs: 1, failed: 0 },
        lastRun: expect.objectContaining({ id: started.id }) as unknown,
      }),
    ]);
    expect(versions.body).toMatchObject([
      { publishedBy: { id: editorId, name: "Ada" }, runs: 1 },
    ]);
  });

  it("the_workflow_list_finds_a_workflow_by_its_title", async () => {
    const titled = aDocument();
    const header = {
      ...(titled.document as JsonObject),
      title: "Route a lead",
    };
    await publish(t, editor, { ...titled, document: header });
    await publish(t, editor, aDocument({ name: "other-flow" }));

    const listed = await request(t.server)
      .get("/api/v1/workflows?q=a%20lead")
      .set(viewer)
      .expect(200);

    expect(listed.body).toMatchObject({ items: [{ name: "route-lead" }] });
  });

  it("a_listed_run_carries_its_workflows_title", async () => {
    const titled = aDocument();
    const header = {
      ...(titled.document as JsonObject),
      title: "Route a lead",
    };
    await publish(t, editor, { ...titled, document: header });
    await start(t, editor);
    await drain(t);

    const listed = await request(t.server)
      .get("/api/v1/instances")
      .set(viewer)
      .expect(200);

    expect(listed.body).toMatchObject({
      items: [{ name: "route-lead", title: "Route a lead" }],
    });
  });

  it("a_workflow_is_read_with_the_title_its_document_gives_or_none", async () => {
    const titled = aDocument();
    const header = {
      ...(titled.document as JsonObject),
      title: "Route a lead",
    };
    await publish(t, editor, { ...titled, document: header });
    await publish(t, editor, aDocument({ name: "other-flow" }));

    const listed = await request(t.server)
      .get("/api/v1/workflows")
      .set(viewer)
      .expect(200);
    const read = await request(t.server)
      .get("/api/v1/workflows/sales/route-lead")
      .set(viewer)
      .expect(200);

    const items = (listed.body as { items: WorkflowItem[] }).items;
    expect(items).toMatchObject([
      { name: "other-flow", title: null },
      { name: "route-lead", title: "Route a lead" },
    ]);
    expect(read.body).toMatchObject({ title: "Route a lead" });
  });

  it("a_waiting_instance_names_its_wait_its_controls_and_its_starter", async () => {
    await publish(t, editor, aWaitingDocument());
    const started = await start(t, editor);
    await drain(t);

    const instance = await instanceOf(t, viewer, started.id);

    expect(instance).toMatchObject({
      phase: "waiting",
      startedBy: { id: editorId, name: "Ada" },
      controls: ["suspend", "cancel"],
      cancelReason: null,
      waits: [{ kind: "timer", stream: null, instanceId: null }],
    });
    expect(instance.waits[0]?.until).toBe("2026-01-01T01:00:00.000Z");
  });

  it("instance_counts_are_given_per_bucket_of_start_time_with_the_runs_live_now", async () => {
    await publish(t, editor, aDocument());
    await start(t, editor);
    await start(t, editor);
    await drain(t);
    await publish(t, editor, aWaitingDocument({ name: "waiter" }));
    await start(t, editor, { input: {} }, "sales/waiter");
    await drain(t);
    const buckets =
      "bucket=2025-12-31T00:00:00.000Z&bucket=2026-01-01T00:00:00.000Z";
    const window = `${buckets}&to=2026-01-02T00:00:00.000Z`;

    const counted = await request(t.server)
      .get(`/api/v1/instance-counts?${window}`)
      .set(viewer)
      .expect(200);

    expect(counted.body).toMatchObject({
      to: "2026-01-02T00:00:00.000Z",
      buckets: [
        { start: "2025-12-31T00:00:00.000Z", counts: { completed: 0 } },
        {
          start: "2026-01-01T00:00:00.000Z",
          counts: { completed: 2, waiting: 1, faulted: 0 },
        },
      ],
      total: { completed: 2, waiting: 1, faulted: 0 },
      previous: null,
      now: { pending: 0, running: 0, waiting: 1, suspended: 0 },
    });
  });

  it.each([
    [
      "descending buckets",
      "bucket=2026-01-02T00:00:00Z&bucket=2026-01-01T00:00:00Z&to=2026-01-03T00:00:00Z",
    ],
    [
      "an end before the last bucket",
      "bucket=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z",
    ],
    [
      "a previous window after the first bucket",
      "bucket=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z&previousFrom=2026-01-01T01:00:00Z",
    ],
    ["no bucket", "to=2026-01-02T00:00:00Z"],
    [
      "the old window form",
      "from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z",
    ],
  ])("a_count_window_with_%s_is_a_bad_request", async (_case, window) => {
    await request(t.server)
      .get(`/api/v1/instance-counts?${window}`)
      .set(viewer)
      .expect(400);
  });

  it("failing_workflows_are_ranked_with_their_last_error_and_whether_they_still_fail", async () => {
    const unavailable = {
      type: "https://example.com/errors/unavailable",
      status: 503,
      title: "Unavailable",
    };
    await publish(
      t,
      editor,
      aDocument({ name: "broken" }, [
        { broken: { raise: { error: unavailable } } },
      ]),
    );
    await start(t, editor, { input: {} }, "sales/broken");
    await drain(t);
    const window = "from=2025-12-31T00:00:00Z&to=2026-01-02T00:00:00Z";

    const failing = await request(t.server)
      .get(`/api/v1/failing-workflows?${window}`)
      .set(viewer)
      .expect(200);
    await request(t.server)
      .get(
        "/api/v1/failing-workflows?from=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z",
      )
      .set(viewer)
      .expect(400);
    await request(t.server)
      .get(`/api/v1/failing-workflows?${window}&limit=101`)
      .set(viewer)
      .expect(400);

    expect(failing.body).toMatchObject({
      items: [
        {
          namespace: "sales",
          name: "broken",
          title: null,
          failed: 1,
          runs: 1,
          lastError: {
            status: 503,
            type: unavailable.type,
            title: "Unavailable",
          },
          stillFailing: true,
        },
      ],
      workflows: 1,
      failed: 1,
    });
  });

  it("the_host_profile_gives_what_the_editor_analyses_against_and_the_limits", async () => {
    const response = await request(t.server)
      .get("/api/v1/host-profile")
      .set(viewer)
      .expect(200);

    expect(response.headers["cache-control"]).toBe("private, max-age=3600");
    expect(response.body).toMatchObject({
      schedules: ["every", "cron", "after", "on"],
      triggers: "one",
      mcpTransportOptions: [],
      limits: { callSeconds: 30, processSeconds: 35, responseBytes: 1_048_576 },
    });
    expect(response.body).toHaveProperty(
      "lifecycleEvents",
      expect.arrayContaining([
        {
          name: "workflow.faulted",
          types: [
            "org.open-workflow-specification.workflow.faulted.v1",
            "io.serverlessworkflow.workflow.faulted.v1",
          ],
        },
      ]),
    );
  });

  it("a_secret_lists_the_workflows_whose_current_version_declares_it", async () => {
    const routeLead = {
      namespace: "sales",
      name: "route-lead",
      version: "1.0.1",
    };
    const audit = { namespace: "ops", name: "audit", version: "1.0.0" };
    for (const name of ["crm", "mail"])
      await request(t.server)
        .post("/api/v1/secrets")
        .set(editor)
        .send({ name, value: "ada-lovelace:s3cret-pass" })
        .expect(201);
    await publish(t, editor, { ...aDocument(), use: { secrets: ["crm"] } });
    await publish(t, editor, {
      ...aDocument({ version: "1.0.1" }),
      use: { secrets: ["crm"] },
    });
    await publish(t, editor, {
      ...aDocument({ namespace: "ops", name: "audit" }),
      use: { secrets: ["crm"] },
    });

    const listed = await request(t.server)
      .get("/api/v1/secrets")
      .set(editor)
      .expect(200);
    expect(listed.body).toMatchObject([
      { name: "crm", usedBy: [audit, routeLead] },
      { name: "mail", usedBy: [] },
    ]);
  });
});
