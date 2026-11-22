import type { ServerResponse } from "node:http";
import { Role } from "../../../src/domain/identity/users/enums.js";
import { authHeaders, createUser, signIn } from "../../support/auth-helpers.js";
import { aDocument } from "../../support/builders.js";
import {
  createRunApp,
  drain,
  eventually,
  instanceOf,
  publish,
  type RunApp,
  resetRuns,
  start,
  statusesOf,
  tasksOf,
} from "../../support/run-helpers.js";
import { startStubServer, type StubServer } from "../../support/stub-server.js";

describe("a run taken over by another application after a crash", () => {
  let first: RunApp;
  let second: RunApp;
  let crm: StubServer;
  const hanging: ServerResponse[] = [];

  beforeAll(async () => {
    crm = await startStubServer((_request, response) => {
      if (crm.received.length === 1) {
        hanging.push(response);
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: 1 }));
    });
    first = await createRunApp();
    second = await createRunApp();
  });

  afterAll(async () => {
    await second.t.close();
    await crm.close();
  });

  it("a_run_whose_application_closed_during_a_call_completes_on_another_and_the_call_keeps_its_idempotency_key", async () => {
    await resetRuns(second.t);
    await createUser(second.t, {
      email: "editor@example.com",
      role: Role.Editor,
    });
    const editor = authHeaders(
      await signIn(second.t.server, "editor@example.com"),
    );
    await publish(
      second.t,
      editor,
      aDocument({}, [
        {
          fetch: {
            call: "http",
            with: { method: "get", endpoint: `${crm.origin}/leads/1` },
          },
        },
        { after: { set: { done: true } } },
      ]),
    );
    const { id } = await start(second.t, editor);

    void drain(first.t).catch(() => undefined);
    await eventually(() => Promise.resolve(hanging.length === 1));
    await first.t.close();
    second.clock.advance("121s");
    await drain(second.t);
    const instance = await instanceOf(second.t, editor, id);
    const tasks = await tasksOf(second.t, editor, id);
    const keys = crm.received.map(
      (request) => request.headers["idempotency-key"],
    );

    expect(instance.phase).toBe("completed");
    expect(instance.output).toEqual({ done: true });
    expect(statusesOf(tasks)).toEqual(["fetch:completed", "after:completed"]);
    const key = `run:${id}:1:/do/0/fetch`;

    expect(keys).toEqual([key, key]);
  });
});
