import { sql } from "drizzle-orm";
import request from "supertest";
import { Role } from "../../../src/domain/identity/enums.js";
import { authHeaders, createUser, signIn } from "../../support/auth-helpers.js";
import { aDocument } from "../../support/builders.js";
import { createTestApp, type TestApp } from "../../support/create-test-app.js";
import { truncateAll } from "../../support/db.js";
import { publishing } from "../../support/run-helpers.js";

const DRAFT = "/api/v1/workflows/sales/route-lead/draft";
const PROBLEM = "application/problem+json";
const TEXT =
  "document:\n  dsl: 1.1.0\n  namespace: sales\n  name: route-lead\n";
const LAYOUT = { greet: { x: 10, y: 20 } };
const WORKFLOW = (name: string, version: string) =>
  [
    "document:",
    "  dsl: 1.1.0",
    "  namespace: sales",
    `  name: ${name}`,
    `  version: ${version}`,
    "do:",
    "  - greet:",
    "      set:",
    "        greeting: hello",
    "",
  ].join("\n");

interface DraftBody {
  readonly source: string;
  readonly savedBy: { readonly id: string; readonly name: string };
}

interface ConflictBody {
  readonly type: string;
  readonly current?: DraftBody;
}

describe("a workflow's shared draft over HTTP", () => {
  let t: TestApp;
  let ada: Record<string, string>;
  let ben: Record<string, string>;
  let viewer: Record<string, string>;
  let adaId: string;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    const author = await createUser(t, {
      email: "ada@example.com",
      role: Role.Editor,
      name: "Ada",
    });
    adaId = author.id;
    await createUser(t, {
      email: "ben@example.com",
      role: Role.Editor,
      name: "Ben",
    });
    await createUser(t, { email: "viewer@example.com", role: Role.Viewer });
    ada = authHeaders(await signIn(t.server, "ada@example.com"));
    ben = authHeaders(await signIn(t.server, "ben@example.com"));
    viewer = authHeaders(await signIn(t.server, "viewer@example.com"));
  });

  async function created(source = TEXT): Promise<string> {
    const response = await request(t.server)
      .put(DRAFT)
      .set(ada)
      .set("If-None-Match", "*")
      .send({ source, layout: LAYOUT })
      .expect(201);
    return String(response.headers.etag);
  }

  it("a_draft_is_created_once_with_its_etag_and_read_back", async () => {
    const etag = await created();

    const read = await request(t.server).get(DRAFT).set(ben).expect(200);
    const again = await request(t.server)
      .put(DRAFT)
      .set(ben)
      .set("If-None-Match", "*")
      .send({ source: "other", layout: {} })
      .expect(412);

    expect(read.headers.etag).toBe(etag);
    expect(read.body).toMatchObject({
      source: TEXT,
      layout: LAYOUT,
      savedBy: { id: adaId, name: "Ada" },
    });
    expect(again.headers.etag).toBe(etag);
    expect(again.body).toMatchObject({
      type: "urn:problem:draft.exists",
      current: { source: TEXT, savedBy: { name: "Ada" } },
    });
  });

  it("a_draft_cannot_take_the_name_of_a_workflow_that_has_no_draft", async () => {
    await publishing(t, ada, aDocument());
    await t.db.execute(sql`delete from draft`);

    const taken = await request(t.server)
      .put(DRAFT)
      .set(ada)
      .set("If-None-Match", "*")
      .send({ source: TEXT, layout: LAYOUT })
      .expect(409);

    expect(taken.headers["content-type"]).toContain(PROBLEM);
    expect(taken.body).toMatchObject({
      type: "urn:problem:workflow.exists",
      status: 409,
    });
  });

  it("a_save_on_an_old_etag_is_refused_with_the_current_draft_and_its_saver", async () => {
    const first = await created();
    const saved = await request(t.server)
      .put(DRAFT)
      .set(ada)
      .set("If-Match", first)
      .send({ source: "ada's edit", layout: LAYOUT })
      .expect(200);

    const stale = await request(t.server)
      .put(DRAFT)
      .set(ben)
      .set("If-Match", first)
      .send({ source: "ben's edit", layout: {} })
      .expect(412);
    const rebased = await request(t.server)
      .put(DRAFT)
      .set(ben)
      .set("If-Match", String(saved.headers.etag))
      .send({ source: "ben's edit", layout: {} })
      .expect(200);

    const conflict = stale.body as ConflictBody;
    expect(saved.headers.etag).not.toBe(first);
    expect(stale.headers.etag).toBe(saved.headers.etag);
    expect(conflict.type).toBe("urn:problem:draft.stale");
    expect(conflict.current).toMatchObject({
      source: "ada's edit",
      savedBy: { name: "Ada" },
    });
    expect(rebased.body).toMatchObject({ savedBy: { name: "Ben" } });
  });

  it("a_retried_save_already_applied_answers_200_with_the_same_etag", async () => {
    const first = await created();
    const edit = { source: "edited", layout: LAYOUT };
    const saved = await request(t.server)
      .put(DRAFT)
      .set(ada)
      .set("If-Match", first)
      .send(edit)
      .expect(200);

    const retried = await request(t.server)
      .put(DRAFT)
      .set(ada)
      .set("If-Match", first)
      .send(edit)
      .expect(200);

    expect(retried.headers.etag).toBe(saved.headers.etag);
  });

  it("a_write_without_the_draft_etag_answers_428_and_is_not_stored", async () => {
    await created();

    const none = await request(t.server)
      .put(DRAFT)
      .set(ada)
      .send({ source: "x", layout: {} })
      .expect(428);
    const any = await request(t.server)
      .post(DRAFT)
      .set(ada)
      .set("If-Match", "*")
      .send(aDocument())
      .expect(428);

    expect(none.headers["cache-control"]).toBe("no-store");
    expect(none.body).toMatchObject({
      type: "urn:problem:draft.precondition-required",
    });
    expect(any.body).toMatchObject({ status: 428 });
  });

  it("a_save_of_a_missing_draft_answers_412_and_an_overlong_name_400", async () => {
    const overlong = "x".repeat(256);

    await request(t.server)
      .put(DRAFT)
      .set(ada)
      .set("If-Match", '"gone"')
      .send({ source: "x", layout: {} })
      .expect(412);
    await request(t.server)
      .put(`/api/v1/workflows/sales/${overlong}/draft`)
      .set(ada)
      .set("If-None-Match", "*")
      .send({ source: "x", layout: {} })
      .expect(400);
  });

  it("a_revalidation_answers_304_until_the_draft_is_saved_again", async () => {
    const first = await created();

    const unchanged = await request(t.server)
      .get(DRAFT)
      .set(ada)
      .set("If-None-Match", first)
      .expect(304);
    await request(t.server)
      .put(DRAFT)
      .set(ada)
      .set("If-Match", first)
      .send({ source: "edited", layout: {} })
      .expect(200);
    const changed = await request(t.server)
      .get(DRAFT)
      .set(ada)
      .set("If-None-Match", first)
      .expect(200);

    expect(unchanged.headers.etag).toBe(first);
    expect(changed.body).toMatchObject({ source: "edited" });
  });

  it("a_publish_from_the_draft_keeps_its_text_as_the_version_source", async () => {
    const text = WORKFLOW("route-lead", "1.0.0");
    const etag = await created(text);

    const published = await request(t.server)
      .post(DRAFT)
      .set(ada)
      .set("If-Match", etag)
      .expect(201);
    const source = await request(t.server)
      .get("/api/v1/workflows/sales/route-lead/versions/1.0.0/source")
      .set(viewer)
      .expect(200);

    expect(published.headers.location).toBe(
      "/api/v1/workflows/sales/route-lead/versions/1.0.0",
    );
    expect(source.body).toEqual({ source: text });
  });

  it("a_publish_runs_the_draft_it_checked_and_never_a_document_sent_beside_it", async () => {
    const text = WORKFLOW("route-lead", "1.0.0");
    const etag = await created(text);

    const published = await request(t.server)
      .post(DRAFT)
      .set(ada)
      .set("If-Match", etag)
      .send(aDocument({ version: "9.9.9" }, [{ other: { set: { x: 1 } } }]))
      .expect(201);
    const structure = await request(t.server)
      .get("/api/v1/workflows/sales/route-lead/versions/1.0.0/structure")
      .set(viewer)
      .expect(200);

    expect(published.headers.location).toBe(
      "/api/v1/workflows/sales/route-lead/versions/1.0.0",
    );
    expect(structure.body).toMatchObject({
      steps: { id: "/do", steps: [{ id: "/do/greet", kind: "set" }] },
    });
  });

  it("a_publish_is_refused_on_a_stale_etag_or_for_another_workflow", async () => {
    const etag = await created(WORKFLOW("other-flow", "1.0.0"));

    await request(t.server)
      .post(DRAFT)
      .set(ada)
      .set("If-Match", '"old"')
      .expect(412);
    const foreign = await request(t.server)
      .post(DRAFT)
      .set(ada)
      .set("If-Match", etag)
      .expect(422);

    expect(foreign.body).toMatchObject({
      type: "urn:problem:definition.other-workflow",
    });
  });

  it("a_viewer_cannot_write_a_draft", async () => {
    await request(t.server)
      .put(DRAFT)
      .set(viewer)
      .set("If-None-Match", "*")
      .send({ source: "x", layout: {} })
      .expect(403);
  });
});
