import request from "supertest";
import type { JsonObject } from "../../../src/domain/automation/interfaces.js";
import { getHttpClientToken, HttpClient } from "@nestjs/http-client";
import { HttpClientName } from "../../../src/frameworks/network/enums.js";
import { Role } from "../../../src/domain/identity/users/enums.js";
import { authHeaders, createUser, signIn } from "../../support/auth-helpers.js";
import { aDocument } from "../../support/builders.js";
import type { TestApp } from "../../support/create-test-app.js";
import {
  createRunApp,
  drain,
  type InstanceBody,
  instanceOf,
  publish,
  type RunApp,
  relay,
  start,
} from "../../support/run-helpers.js";
import { truncateAll } from "../../support/db.js";
import { startStubServer, type StubServer } from "../../support/stub-server.js";
import type { Page } from "../../support/bodies.js";

const ERRORS = "https://open-workflow-specification.org/spec/1.0.0/errors/";
const SANDBOX_TOKEN = "sandbox-token";

const aParent = (version: string, awaited = true): JsonObject =>
  aDocument({}, [
    {
      delegate: {
        run: {
          workflow: { namespace: "sales", name: "child", version },
          await: awaited,
        },
      },
    },
  ]);

const aChild = (version: string, tasks: JsonObject[]): JsonObject =>
  aDocument({ name: "child", version }, tasks);

describe("running sub-workflows and processes as runs of their own", () => {
  let run: RunApp;
  let t: TestApp;
  let editor: Record<string, string>;
  let sandbox: StubServer;

  beforeAll(async () => {
    sandbox = await startStubServer((_request, response) => {
      const result = {
        status: "Accepted",
        exitStatus: 0,
        files: { stdout: "", stderr: "" },
      };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify([result]));
    });
    const client = new HttpClient({
      baseUrl: sandbox.origin,
      headers: { authorization: `Bearer ${SANDBOX_TOKEN}` },
    });
    run = await createRunApp((builder) =>
      builder
        .overrideProvider(getHttpClientToken(HttpClientName.Sandbox))
        .useValue(client),
    );
    t = run.t;
  });

  afterAll(async () => {
    await t.close();
    await sandbox.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    sandbox.received.length = 0;
    await createUser(t, { email: "editor@example.com", role: Role.Editor });
    editor = authHeaders(await signIn(t.server, "editor@example.com"));
  });

  async function children(): Promise<InstanceBody[]> {
    const response = await request(t.server)
      .get("/api/v1/instances?name=child")
      .set(editor)
      .expect(200);
    return (response.body as Page<InstanceBody>).items;
  }

  it("a_parent_naming_the_version_latest_runs_the_current_version_of_its_child", async () => {
    await publish(t, editor, aChild("1.0.0", [{ mark: { set: { v: 1 } } }]));
    await publish(t, editor, aChild("1.1.0", [{ mark: { set: { v: 2 } } }]));
    await publish(t, editor, aParent("latest"));

    const { id } = await start(t, editor);
    await drain(t);
    const parent = await instanceOf(t, editor, id);
    const [child] = await children();

    expect(parent.phase).toBe("completed");
    expect(parent.output).toEqual({ v: 2 });
    expect(child).toMatchObject({ version: "1.1.0", trigger: "parent" });
  });

  it("twenty_parents_each_awaiting_ten_children_in_turn_all_complete", async () => {
    await publish(
      t,
      editor,
      aChild("1.0.0", [{ price: { set: { line: "${ .i * 2 }" } } }]),
    );
    await publish(
      t,
      editor,
      aDocument({}, [
        {
          lines: {
            for: { each: "i", in: "${ [range(10)] }" },
            do: [
              {
                priceLine: {
                  run: {
                    workflow: {
                      namespace: "sales",
                      name: "child",
                      version: "1.0.0",
                      input: { i: "${ $i }" },
                    },
                  },
                },
              },
            ],
          },
        },
      ]),
    );
    const parents = await Promise.all(
      Array.from({ length: 20 }, () => start(t, editor)),
    );
    await drain(t);
    const ended = await Promise.all(
      parents.map((parent) => instanceOf(t, editor, parent.id)),
    );
    const children = await request(t.server)
      .get("/api/v1/instances?name=child&limit=1")
      .set(editor)
      .expect(200);
    const completed = await request(t.server)
      .get("/api/v1/instances?name=child&phase=completed&limit=1")
      .set(editor)
      .expect(200);

    expect(ended.map((parent) => parent.phase)).toEqual(
      Array.from({ length: 20 }, () => "completed"),
    );
    expect((children.body as { total: number }).total).toBe(200);
    expect((completed.body as { total: number }).total).toBe(200);
  }, 180_000);

  it("a_parent_cancelled_while_it_awaits_a_child_ends_cancelled_and_cancels_its_child", async () => {
    await publish(
      t,
      editor,
      aChild("1.0.0", [{ pause: { wait: { hours: 1 } } }]),
    );
    await publish(t, editor, aParent("1.0.0"));
    const { id } = await start(t, editor);
    await drain(t);

    await request(t.server)
      .post(`/api/v1/instances/${id}/cancel`)
      .set(editor)
      .expect(204);
    await relay(t);
    await drain(t);
    const parent = await instanceOf(t, editor, id);
    const phases = (await children()).map((child) => child.phase);

    expect(parent.phase).toBe("cancelled");
    expect(phases).toEqual(["cancelled"]);
  });

  it("a_child_that_faults_faults_its_parent_with_the_childs_error", async () => {
    await publish(
      t,
      editor,
      aChild("1.0.0", [
        {
          refuse: {
            raise: {
              error: {
                type: "https://example.com/errors/refused",
                status: 400,
              },
            },
          },
        },
      ]),
    );
    await publish(t, editor, aParent("1.0.0"));

    const { id } = await start(t, editor);
    await drain(t);
    const parent = await instanceOf(t, editor, id);
    const [child] = await children();

    expect(child?.phase).toBe("faulted");
    expect(parent.phase).toBe("faulted");
    expect(parent.error).toMatchObject({
      type: "https://example.com/errors/refused",
      status: 400,
    });
  });

  it("a_child_cancelled_on_its_own_faults_its_parent_as_a_runtime_error", async () => {
    await publish(
      t,
      editor,
      aChild("1.0.0", [{ pause: { wait: { hours: 1 } } }]),
    );
    await publish(t, editor, aParent("1.0.0"));
    const { id } = await start(t, editor);
    await drain(t);
    const [waiting] = await children();

    await request(t.server)
      .post(`/api/v1/instances/${String(waiting?.id)}/cancel`)
      .set(editor)
      .expect(204);
    await relay(t);
    await drain(t);
    const parent = await instanceOf(t, editor, id);

    expect(parent.phase).toBe("faulted");
    expect(parent.error).toMatchObject({
      type: `${ERRORS}runtime`,
      status: 500,
      detail: "The workflow it ran was cancelled.",
      instance: "/do/0/delegate",
    });
  });

  it("a_child_that_is_not_published_faults_its_parent_as_a_configuration_error_and_starts_nothing", async () => {
    await publish(t, editor, aParent("1.0.0"));

    const { id } = await start(t, editor);
    await drain(t);
    const parent = await instanceOf(t, editor, id);

    expect(parent.phase).toBe("faulted");
    expect(parent.error).toMatchObject({
      type: `${ERRORS}configuration`,
      status: 404,
      instance: "/do/0/delegate",
    });
    expect(await children()).toEqual([]);
  });

  it("an_awaited_child_past_its_deadline_faults_its_parent_with_the_timeout_and_ends_cancelled", async () => {
    await publish(
      t,
      editor,
      aChild("1.0.0", [{ pause: { wait: { hours: 1 } } }]),
    );
    await publish(
      t,
      editor,
      aDocument({}, [
        {
          delegate: {
            run: {
              workflow: { namespace: "sales", name: "child", version: "1.0.0" },
            },
            timeout: { after: { minutes: 1 } },
          },
        },
      ]),
    );

    const { id } = await start(t, editor);
    await drain(t);
    run.clock.advance("2m");
    await drain(t);
    await relay(t);
    await drain(t);
    const parent = await instanceOf(t, editor, id);
    const phases = (await children()).map((child) => child.phase);

    expect(parent.phase).toBe("faulted");
    expect(parent.error).toMatchObject({
      type: `${ERRORS}timeout`,
      status: 408,
      instance: "/do/0/delegate",
    });
    expect(phases).toEqual(["cancelled"]);
  });

  it("a_detached_child_runs_on_after_its_parent_completed", async () => {
    await publish(
      t,
      editor,
      aChild("1.0.0", [{ pause: { wait: { hours: 1 } } }]),
    );
    await publish(t, editor, aParent("1.0.0", false));

    const { id } = await start(t, editor);
    await drain(t);
    const parent = await instanceOf(t, editor, id);
    const [waiting] = await children();
    run.clock.advance("1h");
    await drain(t);
    const [done] = await children();

    expect(parent.phase).toBe("completed");
    expect(waiting).toMatchObject({ phase: "waiting", trigger: "detached" });
    expect(done?.phase).toBe("completed");
  });

  it("a_detached_process_runs_in_the_sandbox_after_its_parent_completed", async () => {
    await publish(
      t,
      editor,
      aDocument({}, [
        {
          notify: {
            run: { shell: { command: "echo done" }, await: false },
          },
        },
      ]),
    );

    const { id } = await start(t, editor);
    await drain(t);
    const parent = await instanceOf(t, editor, id);
    const paths = sandbox.received.map((received) => received.url);

    expect(parent.phase).toBe("completed");
    expect(paths).toEqual(["/run"]);
  });
});
