import request from "supertest";
import { Role } from "../../../src/domain/identity/users/enums.js";
import type { JsonObject } from "../../../src/domain/automation/interfaces.js";
import { authHeaders, createUser, signIn } from "../../support/auth-helpers.js";
import { aDocument } from "../../support/builders.js";
import type { TestApp } from "../../support/create-test-app.js";
import {
  createRunApp,
  drain,
  instanceOf,
  publish,
  resetRuns,
  type RunApp,
} from "../../support/run-helpers.js";

const DRAFT = "/api/v1/workflows/sales/route-lead/draft";
const TEST_RUNS = `${DRAFT}/test-runs`;
const WORKFLOW = "/api/v1/workflows/sales/route-lead";

interface Summary {
  readonly id: string;
  readonly test: boolean;
  readonly version: string;
  readonly phase: string;
}

interface WorkflowBody {
  readonly starts: number;
  readonly lastRun: { readonly id: string } | null;
}

describe("a test run of a draft over HTTP", () => {
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
    await resetRuns(t);
    await createUser(t, { email: "editor@example.com", role: Role.Editor });
    await createUser(t, { email: "viewer@example.com", role: Role.Viewer });
    editor = authHeaders(await signIn(t.server, "editor@example.com"));
    viewer = authHeaders(await signIn(t.server, "viewer@example.com"));
  });

  async function drafted(document: JsonObject): Promise<string> {
    const current = await request(t.server).get(DRAFT).set(editor);
    const source = JSON.stringify(document);
    const write = request(t.server).put(DRAFT).set(editor);
    const precondition =
      current.status === 200
        ? write.set("If-Match", String(current.headers.etag))
        : write.set("If-None-Match", "*");
    const saved = await precondition.send({ source, layout: {} });
    return String(saved.headers.etag);
  }

  it("runs_a_never_published_draft_as_a_test_without_publishing_it", async () => {
    const etag = await drafted(aDocument());

    const created = await request(t.server)
      .post(TEST_RUNS)
      .set(editor)
      .set("If-Match", etag)
      .send({ input: { amount: 1 } })
      .expect(201);
    await drain(t);
    const summary = created.body as Summary;
    const instance = await instanceOf(t, viewer, summary.id);
    const workflow = await request(t.server).get(WORKFLOW).set(viewer);
    const versions = await request(t.server)
      .get(`${WORKFLOW}/versions`)
      .set(viewer);

    expect(summary).toMatchObject({ test: true, version: "1.0.0" });
    expect(instance).toMatchObject({
      phase: "completed",
      input: { amount: 1 },
      test: true,
    });
    expect(workflow.status).toBe(404);
    expect(versions.status).toBe(404);
  });

  it("a_workflow_only_tested_is_neither_turned_on_nor_archived", async () => {
    const etag = await drafted(aDocument());
    await request(t.server)
      .post(TEST_RUNS)
      .set(editor)
      .set("If-Match", etag)
      .send({})
      .expect(201);

    const on = await request(t.server)
      .post(`${WORKFLOW}/turn-on`)
      .set(editor)
      .expect(404);
    const archived = await request(t.server)
      .post(`${WORKFLOW}/archive`)
      .set(editor)
      .expect(404);

    expect(on.body).toMatchObject({ type: "urn:problem:workflow.unpublished" });
    expect(archived.body).toMatchObject({
      type: "urn:problem:workflow.unpublished",
    });
  });

  it("a_test_run_is_left_out_of_the_published_workflows_starts_and_versions", async () => {
    await publish(t, editor, aDocument());
    const etag = await drafted(aDocument({}, [{ other: { set: { x: 1 } } }]));

    await request(t.server)
      .post(TEST_RUNS)
      .set(editor)
      .set("If-Match", etag)
      .send({})
      .expect(201);
    const workflow = await request(t.server)
      .get(WORKFLOW)
      .set(viewer)
      .expect(200);
    const versions = await request(t.server)
      .get(`${WORKFLOW}/versions`)
      .set(viewer)
      .expect(200);

    const body = workflow.body as WorkflowBody;
    expect(body.starts).toBe(0);
    expect(body.lastRun).toBeNull();
    expect(versions.body).toHaveLength(1);
  });

  it("a_test_run_needs_the_drafts_current_etag", async () => {
    await drafted(aDocument());

    const required = await request(t.server)
      .post(TEST_RUNS)
      .set(editor)
      .send({})
      .expect(428);
    const stale = await request(t.server)
      .post(TEST_RUNS)
      .set(editor)
      .set("If-Match", '"an-old-revision"')
      .send({})
      .expect(412);

    expect(required.body).toMatchObject({
      type: "urn:problem:draft.precondition-required",
    });
    expect(stale.body).toMatchObject({
      type: "urn:problem:draft.stale",
      current: { source: expect.any(String) as unknown },
    });
  });

  it("an_input_the_draft_refuses_is_answered_field_by_field", async () => {
    const schema = {
      type: "object",
      required: ["customer"],
      properties: { customer: { type: "string" } },
    };
    const etag = await drafted({
      ...aDocument(),
      input: { schema: { format: "json", document: schema } },
    });

    const refused = await request(t.server)
      .post(TEST_RUNS)
      .set(editor)
      .set("If-Match", etag)
      .send({ input: {} })
      .expect(422);

    expect(refused.body).toMatchObject({
      type: "urn:problem:instance.input-invalid",
      errors: [{ pointer: "/input/customer", detail: "Customer is required." }],
    });
  });

  it("a_draft_with_problems_is_answered_with_them_and_a_missing_draft_is_not_found", async () => {
    const etag = await drafted({ document: aDocument().document });

    const invalid = await request(t.server)
      .post(TEST_RUNS)
      .set(editor)
      .set("If-Match", etag)
      .send({})
      .expect(422);
    await request(t.server)
      .post("/api/v1/workflows/sales/nobody/draft/test-runs")
      .set(editor)
      .set("If-Match", etag)
      .send({})
      .expect(404);

    expect(invalid.body).toMatchObject({
      type: "urn:problem:definition.invalid",
    });
  });

  it("a_viewer_cannot_test_a_draft_and_a_malformed_body_is_a_bad_request", async () => {
    const etag = await drafted(aDocument());

    await request(t.server)
      .post(TEST_RUNS)
      .set(viewer)
      .set("If-Match", etag)
      .send({})
      .expect(403);
    await request(t.server)
      .post(TEST_RUNS)
      .set(editor)
      .set("If-Match", etag)
      .send({ input: {}, version: "1.0.0" })
      .expect(400);
  });
});
