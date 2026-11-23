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
  instanceOf,
  publish,
  publishing,
  type RunApp,
  resetRuns,
  start,
  tasksOf,
} from "../../support/run-helpers.js";
import { startStubServer, type StubServer } from "../../support/stub-server.js";
import type { Created, Page, Problem } from "../../support/bodies.js";

const PROBLEM = "application/problem+json";
const ECHO = "/echo";
const TOKEN = "tok-live-87654321";
const CREDENTIAL = JSON.stringify({
  username: "ada-lovelace",
  password: "s3cret-pass",
});
const BASIC = `Basic ${Buffer.from("ada-lovelace:s3cret-pass").toString("base64")}`;

const aCallingDocument = (origin: string): JsonObject => ({
  ...aDocument({}, [
    {
      fetch: {
        call: "http",
        with: {
          method: "get",
          endpoint: {
            uri: `${origin}/leads/1`,
            authentication: { use: "crmLogin" },
          },
        },
      },
    },
  ]),
  use: {
    secrets: ["crm"],
    authentications: { crmLogin: { basic: { use: "crm" } } },
  },
});

interface StoredEvent {
  readonly type: string;
  readonly data: unknown;
}

describe("keeping credentials for workflows", () => {
  let run: RunApp;
  let t: TestApp;
  let editor: Record<string, string>;
  let other: Record<string, string>;
  let viewer: Record<string, string>;
  let crm: StubServer;

  beforeAll(async () => {
    crm = await startStubServer((received, response) => {
      const echoed = received.url.startsWith(ECHO);
      const body = echoed
        ? { url: received.url, apiKey: received.headers["x-api-key"] }
        : { id: 1 };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
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
    crm.received.length = 0;
    await createUser(t, { email: "editor@example.com", role: Role.Editor });
    await createUser(t, { email: "other@example.com", role: Role.Editor });
    await createUser(t, { email: "viewer@example.com", role: Role.Viewer });
    editor = authHeaders(await signIn(t.server, "editor@example.com"));
    other = authHeaders(await signIn(t.server, "other@example.com"));
    viewer = authHeaders(await signIn(t.server, "viewer@example.com"));
  });

  async function eventsOf(id: string): Promise<StoredEvent[]> {
    const response = await request(t.server)
      .get(`/api/v1/instances/${id}/events?limit=200`)
      .set(editor)
      .expect(200);
    return (response.body as Page<StoredEvent>).items;
  }

  async function createSecret(
    headers: Record<string, string>,
    name: string,
    value: string,
  ): Promise<void> {
    await request(t.server)
      .post("/api/v1/secrets")
      .set(headers)
      .send({ name, value })
      .expect(201);
  }

  it("a_secret_is_listed_by_name_and_its_value_is_never_returned_nor_stored_plain", async () => {
    const created = await request(t.server)
      .post("/api/v1/secrets")
      .set(editor)
      .send({ name: "crm", value: CREDENTIAL })
      .expect(201);
    const listed = await request(t.server)
      .get("/api/v1/secrets")
      .set(editor)
      .expect(200);
    const stored = await t.db.execute(sql`select sealed from secret`);

    expect(Object.keys(created.body as object).sort()).toEqual([
      "createdAt",
      "name",
      "updatedAt",
    ]);
    expect(listed.body).toEqual([{ ...created.body, usedBy: [] }]);
    expect(JSON.stringify(stored.rows)).not.toContain("s3cret-pass");
  });

  it("a_name_is_taken_once_per_owner_and_secrets_are_their_owners_own", async () => {
    await createSecret(editor, "crm", CREDENTIAL);

    const again = await request(t.server)
      .post("/api/v1/secrets")
      .set(editor)
      .send({ name: "crm", value: "other" });
    await createSecret(other, "crm", "others-value");
    const theirs = await request(t.server).get("/api/v1/secrets").set(other);

    expect(again.status).toBe(409);
    expect(again.headers["content-type"]).toContain(PROBLEM);
    expect(theirs.body).toHaveLength(1);
  });

  it("a_secret_holding_a_text_shorter_than_four_characters_is_refused_and_not_kept", async () => {
    const short = JSON.stringify({ username: "ada", password: "s3cret-pass" });

    const refused = await request(t.server)
      .post("/api/v1/secrets")
      .set(editor)
      .send({ name: "crm", value: short });
    const listed = await request(t.server)
      .get("/api/v1/secrets")
      .set(editor)
      .expect(200);

    expect(refused.status).toBe(422);
    expect(refused.headers["content-type"]).toContain(PROBLEM);
    expect(refused.body).toMatchObject({
      type: "urn:problem:secret.too-short",
      status: 422,
    });
    expect(listed.body).toEqual([]);
  });

  it("a_viewer_keeps_no_secrets", async () => {
    await request(t.server).get("/api/v1/secrets").set(viewer).expect(403);
  });

  it("a_task_authenticates_with_the_value_of_its_publishers_secret", async () => {
    await createSecret(editor, "crm", CREDENTIAL);
    await publish(t, editor, aCallingDocument(crm.origin));

    const { id } = await start(t, editor);
    await drain(t);
    const authorizations = crm.received.map(
      (request) => request.headers.authorization,
    );

    expect((await instanceOf(t, editor, id)).phase).toBe("completed");
    expect(authorizations).toEqual([BASIC]);
  });

  it("two_testers_of_one_draft_each_run_it_with_their_own_secret_of_the_same_name", async () => {
    const theirs = JSON.stringify({
      username: "grace",
      password: "h0pper-pass",
    });
    const theirBasic = `Basic ${Buffer.from("grace:h0pper-pass").toString("base64")}`;
    const draft = "/api/v1/workflows/sales/route-lead/draft";
    const source = JSON.stringify(aCallingDocument(crm.origin));
    await createSecret(editor, "crm", CREDENTIAL);
    await createSecret(other, "crm", theirs);
    const saved = await request(t.server)
      .put(draft)
      .set(editor)
      .set("If-None-Match", "*")
      .send({ source, layout: {} })
      .expect(201);
    const etag = String(saved.headers.etag);

    for (const tester of [editor, other])
      await request(t.server)
        .post(`${draft}/test-runs`)
        .set(tester)
        .set("If-Match", etag)
        .send({})
        .expect(201);
    await drain(t);
    const authorizations = crm.received.map(
      (request) => request.headers.authorization,
    );

    expect(authorizations).toHaveLength(2);
    expect(authorizations).toEqual(expect.arrayContaining([BASIC, theirBasic]));
  });

  it("a_replaced_value_is_the_one_the_next_run_uses", async () => {
    await createSecret(editor, "crm", CREDENTIAL);
    await publish(t, editor, aCallingDocument(crm.origin));
    const replaced = JSON.stringify({
      username: "ada-lovelace",
      password: "n3w-pass",
    });
    await request(t.server)
      .put("/api/v1/secrets/crm")
      .set(editor)
      .send({ value: replaced })
      .expect(204);

    await start(t, editor);
    await drain(t);
    const authorizations = crm.received.map(
      (request) => request.headers.authorization,
    );

    const expected = Buffer.from("ada-lovelace:n3w-pass").toString("base64");
    expect(authorizations).toEqual([`Basic ${expected}`]);
  });

  it("a_version_naming_a_secret_its_publisher_does_not_own_is_refused_there", async () => {
    await createSecret(editor, "crm", CREDENTIAL);

    const response = await publishing(t, other, aCallingDocument(crm.origin));

    expect(response.status).toBe(422);
    expect((response.body as Problem).errors).toMatchObject([
      { code: "unknown-secret", pointer: "/use/secrets/0" },
    ]);
  });

  it("a_policy_naming_a_secret_not_declared_in_use_secrets_is_refused", async () => {
    await createSecret(editor, "crm", CREDENTIAL);
    const document = aCallingDocument(crm.origin);
    const use = document.use as JsonObject;

    const response = await publishing(t, editor, {
      ...document,
      use: { ...use, secrets: [] },
    });

    expect(response.status).toBe(422);
    expect((response.body as Problem).errors[0]?.pointer).toBe(
      "/use/authentications/crmLogin/basic/use",
    );
  });

  it("a_task_needing_a_deleted_secret_raises_an_authorization_error", async () => {
    await createSecret(editor, "crm", CREDENTIAL);
    await publish(t, editor, aCallingDocument(crm.origin));
    await request(t.server)
      .delete("/api/v1/secrets/crm")
      .set(editor)
      .expect(204);

    const { id } = await start(t, editor);
    await drain(t);
    const instance = await instanceOf(t, editor, id);

    expect(instance.phase).toBe("faulted");
    expect(instance.error).toMatchObject({
      type: "https://open-workflow-specification.org/spec/1.0.0/errors/authorization",
      status: 403,
    });
  });

  it("a_value_passed_into_data_is_masked_wherever_the_platform_records_it", async () => {
    await createSecret(editor, "token", "tok-12345678");
    await publish(t, editor, {
      ...aDocument({}, [
        {
          announce: {
            emit: {
              event: {
                with: {
                  source: "https://shop.example.com",
                  type: "com.example.token",
                  data: { token: "${ .token }" },
                },
              },
            },
            output: { as: "${ $input }" },
          },
        },
        {
          fail: {
            raise: {
              error: {
                type: "https://example.com/errors/leak",
                status: 400,
                detail: '${ "leaked " + .token }',
              },
            },
          },
        },
      ]),
      input: { from: "${ { token: $secrets.token } }" },
      use: { secrets: ["token"] },
    });

    const { id } = await start(t, editor);
    await drain(t);
    const instance = await instanceOf(t, editor, id);
    const tasks = await tasksOf(t, editor, id);
    const events = await eventsOf(id);
    const emitted = events.filter(
      (event) => event.type === "com.example.token",
    );
    const failed = tasks.find((task) => task.name === "fail");

    expect(instance.error).toMatchObject({ detail: "leaked ***" });
    expect(failed?.error).toMatchObject({ detail: "leaked ***" });
    expect(emitted.map((event) => event.data)).toEqual([{ token: "***" }]);
    expect(JSON.stringify(events)).not.toContain("tok-12345678");
  });

  it("a_secret_a_task_sent_in_a_header_and_a_url_is_masked_in_every_run_record", async () => {
    await createSecret(editor, "token", TOKEN);
    await publish(t, editor, {
      ...aDocument({}, [
        {
          fetch: {
            call: "http",
            with: {
              method: "get",
              endpoint: `\${ "${crm.origin}${ECHO}?key=" + $secrets.token }`,
              headers: { "x-api-key": "${ $secrets.token }" },
            },
          },
        },
      ]),
      use: { secrets: ["token"] },
    });

    const { id } = await start(t, editor);
    await drain(t);
    const instance = await instanceOf(t, editor, id);
    const tasks = await tasksOf(t, editor, id);
    const events = await eventsOf(id);
    const output = await request(t.server)
      .get(
        `/api/v1/instances/${id}/tasks/${encodeURIComponent("/do/0/fetch")}/output`,
      )
      .set(editor)
      .expect(200);
    const list = await request(t.server)
      .get("/api/v1/instances?tests=true")
      .set(editor)
      .expect(200);
    const sent = crm.received.map((received) => received.headers["x-api-key"]);
    const records = JSON.stringify([
      instance,
      tasks,
      events,
      output.body,
      list.body,
    ]);

    expect(sent).toEqual([TOKEN]);
    expect(instance.output).toEqual({ url: `${ECHO}?key=***`, apiKey: "***" });
    expect(output.body).toEqual({ url: `${ECHO}?key=***`, apiKey: "***" });
    expect(records).not.toContain(TOKEN);
  });

  it("a_secret_holding_another_is_masked_whole", async () => {
    await createSecret(editor, "alpha", "tok-1234");
    await createSecret(editor, "beta", "tok-1234-5678");
    await publish(t, editor, {
      ...aDocument({}, [{ keep: { set: { echoed: "${ .both }" } } }]),
      input: {
        from: '${ { both: ($secrets.alpha + " " + $secrets.beta) } }',
      },
      use: { secrets: ["alpha", "beta"] },
    });

    const { id } = await start(t, editor);
    await drain(t);
    const instance = await instanceOf(t, editor, id);

    expect(instance.output).toEqual({ echoed: "*** ***" });
  });

  it("a_parent_sees_the_true_output_of_its_child_while_the_child_is_stored_masked", async () => {
    await createSecret(editor, "token", "tok-12345678");
    await publish(t, editor, {
      ...aDocument({ name: "child" }, [
        { keep: { set: { token: "${ .token }" } } },
      ]),
      input: { from: "${ { token: $secrets.token } }" },
      use: { secrets: ["token"] },
    });
    await publish(
      t,
      editor,
      aDocument({}, [
        {
          delegate: {
            run: {
              workflow: { namespace: "sales", name: "child", version: "1.0.0" },
            },
          },
        },
        { compare: { set: { masked: '${ .token == "***" }' } } },
      ]),
    );

    const { id } = await start(t, editor);
    await drain(t);
    const parent = await instanceOf(t, editor, id);
    const children = await request(t.server)
      .get("/api/v1/instances?name=child")
      .set(editor)
      .expect(200);
    const childId = String((children.body as Page<Created>).items[0]?.id);
    const child = await instanceOf(t, editor, childId);

    expect(parent.output).toEqual({ masked: false });
    expect(child.output).toEqual({ token: "***" });
  });
});
