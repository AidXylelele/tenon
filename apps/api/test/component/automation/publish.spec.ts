import request from "supertest";
import { Role } from "../../../src/domain/identity/users/enums.js";
import { StructureClient } from "../../../src/interface-adapters/workflows/interfaces.js";
import { authHeaders, createUser, signIn } from "../../support/auth-helpers.js";
import { aDocument } from "../../support/builders.js";
import { createTestApp, type TestApp } from "../../support/create-test-app.js";
import { truncateAll } from "../../support/db.js";
import type { Page, Problem } from "../../support/bodies.js";
import { publish, publishing } from "../../support/run-helpers.js";

const PROBLEM = "application/problem+json";
const DRAFT = "/api/v1/workflows/sales/route-lead/draft";

describe("publishing workflow definitions over HTTP", () => {
  let t: TestApp;
  let editor: Record<string, string>;
  let viewer: Record<string, string>;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    await createUser(t, { email: "editor@example.com", role: Role.Editor });
    await createUser(t, { email: "viewer@example.com", role: Role.Viewer });
    editor = authHeaders(await signIn(t.server, "editor@example.com"));
    viewer = authHeaders(await signIn(t.server, "viewer@example.com"));
  });

  it("a_valid_document_becomes_the_current_version_and_reads_back_as_the_same_json", async () => {
    const document = aDocument();

    const published = await publishing(t, editor, document);
    const workflow = await request(t.server)
      .get("/api/v1/workflows/sales/route-lead")
      .set(viewer)
      .expect(200);
    const stored = await request(t.server)
      .get("/api/v1/workflows/sales/route-lead/versions/1.0.0")
      .set(viewer)
      .expect(200);

    expect(published.status).toBe(201);
    expect(published.headers.location).toBe(
      "/api/v1/workflows/sales/route-lead/versions/1.0.0",
    );
    expect(published.body).toMatchObject({
      namespace: "sales",
      name: "route-lead",
      version: "1.0.0",
      dsl: "1.1.0",
      current: true,
    });
    expect(workflow.body).toEqual({
      namespace: "sales",
      name: "route-lead",
      status: "active",
      on: false,
      currentVersion: "1.0.0",
      schedule: null,
      week: { runs: 0, failed: 0 },
      lastRun: null,
      title: null,
    });
    expect(stored.body).toEqual(document);
  });

  it("the_same_document_again_answers_200_with_the_published_version", async () => {
    const first = await publishing(t, editor, aDocument());
    const reordered = { do: aDocument().do, document: aDocument().document };

    const again = await publishing(t, editor, reordered);

    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body).toEqual(first.body);
  });

  it("other_content_under_a_published_identity_is_a_conflict", async () => {
    await publish(t, editor, aDocument());
    const changed = aDocument({}, [{ other: { set: { x: 1 } } }]);

    const conflict = await publishing(t, editor, changed);

    expect(conflict.status).toBe(409);
    expect(conflict.headers["content-type"]).toContain(PROBLEM);
    expect(conflict.body).toMatchObject({
      type: "urn:problem:workflow.version-taken",
      status: 409,
    });
  });

  it("a_document_with_two_defects_answers_both_located_and_stores_nothing", async () => {
    const document = aDocument({}, [
      { greet: { set: { x: 1 }, thn: "end" } },
      { pause: { wait: "soon" } },
    ]);

    const refused = await publishing(t, editor, document);
    await request(t.server)
      .get("/api/v1/workflows/sales/route-lead")
      .set(viewer)
      .expect(404);

    expect(refused.status).toBe(422);
    expect(refused.headers["content-type"]).toContain(PROBLEM);
    expect(refused.body).toMatchObject({
      type: "urn:problem:definition.invalid",
      title: "The workflow definition is invalid",
      status: 422,
      errors: [
        {
          code: "schema",
          pointer: "/do/0/greet/thn",
          line: 1,
          column: expect.any(Number) as unknown,
        },
        {
          code: "schema",
          pointer: "/do/1/pause/wait",
          line: 1,
          column: expect.any(Number) as unknown,
        },
      ],
    });
  });

  it("tasks_needing_what_the_host_cannot_run_are_refused_at_those_tasks", async () => {
    const document = aDocument({}, [
      { build: { run: { container: { image: "alpine:3" } } } },
      {
        race: {
          fork: {
            branches: [
              { left: { run: { container: { image: "alpine:3" } } } },
              { right: { set: { side: "right" } } },
            ],
          },
        },
      },
    ]);

    const refused = await publishing(t, editor, document);

    expect(refused.status).toBe(422);
    expect((refused.body as Problem).errors).toMatchObject([
      { code: "capability", pointer: "/do/0/build" },
      { code: "capability", pointer: "/do/1/race/fork/branches/0/left" },
    ]);
  });

  it("a_second_trigger_and_an_mcp_transport_option_are_refused_as_the_host_runs_neither", async () => {
    const document = {
      ...aDocument({}, [
        {
          tools: {
            call: "mcp",
            with: {
              method: "tools/list",
              transport: {
                http: { endpoint: "https://mcp.example.com/mcp" },
                options: { sessionMode: "stateless" },
              },
            },
          },
        },
      ]),
      schedule: { every: { minutes: 5 }, cron: "0 * * * *" },
    };

    const refused = await publishing(t, editor, document);

    expect(refused.status).toBe(422);
    expect((refused.body as Problem).errors).toMatchObject([
      {
        code: "capability",
        pointer: "/do/0/tools",
        detail: "The host does not provide 'mcpOption.sessionMode'.",
      },
      {
        code: "capability",
        pointer: "/schedule",
        detail: "The host does not provide 'triggers.many'.",
      },
    ]);
  });

  it("checking_answers_as_publishing_would_and_stores_nothing", async () => {
    await request(t.server)
      .post("/api/v1/workflows/check")
      .set(editor)
      .send(aDocument())
      .expect(204);
    await request(t.server)
      .get("/api/v1/workflows/sales/route-lead")
      .set(viewer)
      .expect(404);
    const invalid = aDocument({ dsl: "0.9.0" });

    await request(t.server)
      .post("/api/v1/workflows/check")
      .set(editor)
      .send(invalid)
      .expect(422);
  });

  it("a_refused_check_answers_the_problems_a_refused_publish_does", async () => {
    const document = aDocument({}, [
      { greet: { set: { x: 1 }, thn: "end" } },
      { pause: { wait: "soon" } },
    ]);

    const checked = await request(t.server)
      .post("/api/v1/workflows/check")
      .set(editor)
      .send(document)
      .expect(422);
    const published = await publishing(t, editor, document);

    const located = (published.body as Problem).errors.map((error) => ({
      code: error.code,
      pointer: error.pointer,
      detail: error.detail,
    }));
    const unlocated = (checked.body as Problem).errors.map((error) => ({
      code: error.code,
      pointer: error.pointer,
      detail: error.detail,
    }));

    expect(published.status).toBe(422);
    expect(checked.headers["content-type"]).toContain(PROBLEM);
    expect(unlocated).toEqual(located);
    expect((checked.body as Problem).errors[0]).toEqual({
      code: "schema",
      pointer: "/do/0/greet/thn",
      detail: expect.any(String) as unknown,
      line: null,
      column: null,
    });
  });

  it("a_body_that_is_not_json_is_refused_as_an_unsupported_media_type", async () => {
    await request(t.server)
      .post(DRAFT)
      .set(editor)
      .type("application/yaml")
      .send("document:\n  dsl: 1.0.3\n")
      .expect(415);
  });

  it("a_body_that_is_not_a_json_object_is_a_bad_request", async () => {
    await request(t.server)
      .post("/api/v1/workflows/check")
      .set(editor)
      .send([1, 2, 3])
      .expect(400);
  });

  it("an_archived_workflow_takes_no_new_version_and_lists_as_archived", async () => {
    await publish(t, editor, aDocument());

    await request(t.server)
      .post("/api/v1/workflows/sales/route-lead/archive")
      .set(editor)
      .expect(204);
    await request(t.server)
      .post("/api/v1/workflows/sales/route-lead/archive")
      .set(editor)
      .expect(204);
    const refused = await publishing(
      t,
      editor,
      aDocument({ version: "2.0.0" }),
    );
    const archived = await request(t.server)
      .get("/api/v1/workflows?status=archived")
      .set(viewer)
      .expect(200);
    const active = await request(t.server)
      .get("/api/v1/workflows?status=active")
      .set(viewer)
      .expect(200);

    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({
      type: "urn:problem:workflow.archived",
    });
    expect((archived.body as Page<unknown>).items).toEqual([
      {
        namespace: "sales",
        name: "route-lead",
        status: "archived",
        on: false,
        currentVersion: "1.0.0",
        schedule: null,
        week: { runs: 0, failed: 0 },
        lastRun: null,
        title: null,
      },
    ]);
    expect((active.body as Page<unknown>).items).toEqual([]);
  });

  it("archiving_an_unknown_workflow_is_not_found", async () => {
    const missing = await request(t.server)
      .post("/api/v1/workflows/sales/missing/archive")
      .set(editor)
      .expect(404);

    expect(missing.body).toMatchObject({
      type: "urn:problem:workflow.not-found",
    });
  });

  it("a_name_or_version_outside_the_standard_is_looked_up_and_not_found", async () => {
    await publish(t, editor, aDocument());

    const name = await request(t.server)
      .get("/api/v1/workflows/sales/route_lead")
      .set(viewer)
      .expect(404);
    const version = await request(t.server)
      .get("/api/v1/workflows/sales/route-lead/versions/latest")
      .set(viewer)
      .expect(404);

    expect(name.body).toMatchObject({ type: "urn:problem:workflow.not-found" });
    expect(version.body).toMatchObject({ status: 404 });
  });

  it("versions_list_in_publishing_order_and_an_unknown_workflow_has_none", async () => {
    await publish(t, editor, aDocument());
    await publish(t, editor, aDocument({ version: "1.1.0" }));

    const versions = await request(t.server)
      .get("/api/v1/workflows/sales/route-lead/versions")
      .set(viewer)
      .expect(200);
    await request(t.server)
      .get("/api/v1/workflows/sales/missing/versions")
      .set(viewer)
      .expect(404);

    expect(versions.body).toMatchObject([
      { version: "1.0.0", current: false },
      { version: "1.1.0", current: true },
    ]);
  });

  it("the_workflow_list_pages_by_namespace_and_name", async () => {
    for (const name of ["alpha", "beta", "gamma"]) {
      const document = aDocument({ name });
      await publish(t, editor, document);
    }

    const first = await request(t.server)
      .get("/api/v1/workflows?limit=2")
      .set(viewer)
      .expect(200);
    const second = await request(t.server)
      .get(
        `/api/v1/workflows?limit=2&cursor=${String((first.body as Page<unknown>).next)}`,
      )
      .set(viewer)
      .expect(200);

    const names = (body: { items: { name: string }[] }) =>
      body.items.map((item) => item.name);
    expect(names(first.body as Page<{ name: string }>)).toEqual([
      "alpha",
      "beta",
    ]);
    expect(names(second.body as Page<{ name: string }>)).toEqual(["gamma"]);
    expect((second.body as Page<unknown>).next).toBeNull();
  });

  it("a_viewer_reads_but_neither_publishes_nor_archives", async () => {
    await request(t.server)
      .post(DRAFT)
      .set(viewer)
      .set("If-Match", '"any"')
      .send(aDocument())
      .expect(403);
    await request(t.server)
      .post("/api/v1/workflows/sales/route-lead/archive")
      .set(viewer)
      .expect(403);
    await request(t.server).get("/api/v1/workflows").set(viewer).expect(200);
  });

  it("without_a_session_nothing_is_answered", async () => {
    await request(t.server).get("/api/v1/workflows").expect(401);
    await request(t.server)
      .post(DRAFT)
      .set("If-Match", '"any"')
      .send(aDocument())
      .expect(401);
  });

  it("a_version_structure_names_its_steps_and_revalidates_with_304", async () => {
    await publish(t, editor, aDocument());
    const path = "/api/v1/workflows/sales/route-lead/versions/1.0.0/structure";

    const read = await request(t.server).get(path).set(viewer).expect(200);
    const again = await request(t.server)
      .get(path)
      .set(viewer)
      .set("If-None-Match", String(read.headers.etag))
      .expect(304);
    await request(t.server)
      .get("/api/v1/workflows/sales/route-lead/versions/9.9.9/structure")
      .set(viewer)
      .expect(404);

    expect(read.body).toMatchObject({
      namespace: "sales",
      name: "route-lead",
      steps: { id: "/do", steps: [{ id: "/do/greet", kind: "set" }] },
    });
    expect(again.headers.etag).toBe(read.headers.etag);
    expect(read.body).toMatchObject({
      title: null,
      summary: null,
      input: { schema: null },
    });
  });

  it("a_structure_revalidation_answers_304_without_analysing_the_version_again", async () => {
    await publish(t, editor, aDocument());
    const path = "/api/v1/workflows/sales/route-lead/versions/1.0.0/structure";
    const read = await request(t.server).get(path).set(viewer).expect(200);
    const projected = vi.spyOn(t.app.get(StructureClient), "structureOf");

    await request(t.server)
      .get(path)
      .set(viewer)
      .set("If-None-Match", String(read.headers.etag))
      .expect(304);

    expect(projected).not.toHaveBeenCalled();
    projected.mockRestore();
  });

  it("a_version_structure_gives_the_summary_and_the_input_schema_a_start_form_is_built_from", async () => {
    const schema = {
      type: "object",
      properties: { lead: { type: "string" } },
      required: ["lead"],
    };
    const document = aDocument();
    const published = await publishing(t, editor, {
      ...document,
      document: {
        ...(document.document as object),
        title: "Route a lead",
        summary: "Sends each new lead to its owner",
      },
      input: { schema: { format: "json", document: schema } },
    });
    expect(published.status).toBe(201);

    const read = await request(t.server)
      .get("/api/v1/workflows/sales/route-lead/versions/1.0.0/structure")
      .set(viewer)
      .expect(200);

    expect(read.body).toMatchObject({
      title: "Route a lead",
      summary: "Sends each new lead to its owner",
      input: { schema: { format: "json", document: schema } },
    });
  });
});
