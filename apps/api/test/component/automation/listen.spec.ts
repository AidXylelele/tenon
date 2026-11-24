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
  type RunApp,
  relay,
  start,
} from "../../support/run-helpers.js";
import { truncateAll } from "../../support/db.js";

const STRUCTURED = "application/cloudevents+json";

const aListeningDocument = (to: JsonObject): JsonObject =>
  aDocument({}, [
    { awaitOrder: { listen: { to } } },
    { keep: { set: { received: "${ . }" } } },
  ]);

const placed = (id: string, data: JsonObject): JsonObject => ({
  specversion: "1.0",
  id,
  source: "/shop",
  type: "order.placed",
  data,
});

const anEvent = (type: string, id: string): JsonObject => ({
  specversion: "1.0",
  id,
  source: "/shop",
  type,
  data: { id },
});

describe("a run that listens for events", () => {
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
  });

  async function accept(event: JsonObject): Promise<void> {
    await request(t.server)
      .post("/api/v1/events")
      .set(editor)
      .set("content-type", STRUCTURED)
      .send(JSON.stringify(event))
      .expect(202);
  }

  async function send(event: JsonObject): Promise<void> {
    await accept(event);
    await relay(t);
    await drain(t);
  }

  it("an_event_of_the_awaited_type_resumes_the_run_with_its_data", async () => {
    const one = { one: { with: { type: "order.placed" } } };
    await publish(t, editor, aListeningDocument(one));
    const { id } = await start(t, editor);
    await drain(t);

    expect((await instanceOf(t, editor, id)).phase).toBe("waiting");

    await send(placed("order-1", { total: 42 }));
    const instance = await instanceOf(t, editor, id);

    expect(instance.phase).toBe("completed");
    expect(instance.output).toEqual({ received: [{ total: 42 }] });
  });

  it("a_listen_past_its_deadline_faults_the_run_with_the_standards_timeout", async () => {
    await publish(
      t,
      editor,
      aDocument({}, [
        {
          awaitOrder: {
            listen: { to: { one: { with: { type: "order.placed" } } } },
            timeout: { after: { minutes: 1 } },
          },
        },
      ]),
    );
    const { id } = await start(t, editor);
    await drain(t);

    run.clock.advance("1m");
    await drain(t);
    const instance = await instanceOf(t, editor, id);

    expect(instance.phase).toBe("faulted");
    expect(instance.error).toMatchObject({
      type: "https://open-workflow-specification.org/spec/1.0.0/errors/timeout",
      status: 408,
      instance: "/do/0/awaitOrder",
    });
  });

  it("every_run_listening_for_the_type_receives_the_event", async () => {
    const one = { one: { with: { type: "order.placed" } } };
    await publish(t, editor, aListeningDocument(one));
    const first = await start(t, editor);
    const second = await start(t, editor);
    await drain(t);

    await send(placed("order-1", { total: 7 }));

    expect((await instanceOf(t, editor, first.id)).phase).toBe("completed");
    expect((await instanceOf(t, editor, second.id)).phase).toBe("completed");
  });

  it("an_event_accepted_before_the_listen_began_does_not_reach_it", async () => {
    const one = { one: { with: { type: "order.placed" } } };
    await publish(t, editor, aListeningDocument(one));
    await send(placed("order-early", { total: 1 }));

    const { id } = await start(t, editor);
    await drain(t);

    expect((await instanceOf(t, editor, id)).phase).toBe("waiting");
  });

  it("an_event_its_filter_refuses_leaves_the_run_waiting", async () => {
    const big = {
      one: {
        with: { type: "order.placed", data: "${ .total > 100 }" },
      },
    };
    await publish(t, editor, aListeningDocument(big));
    const { id } = await start(t, editor);
    await drain(t);

    await send(placed("order-small", { total: 5 }));

    expect((await instanceOf(t, editor, id)).phase).toBe("waiting");

    await send(placed("order-big", { total: 500 }));

    expect((await instanceOf(t, editor, id)).phase).toBe("completed");
  });

  it("events_accepted_while_a_run_emits_all_reach_its_listen", async () => {
    const emits = {
      loop: {
        for: { each: "item", in: "${ [range(0; 20)] }" },
        do: [
          {
            tell: {
              emit: {
                event: {
                  with: {
                    source: "https://shop.example.com",
                    type: "com.example.tick",
                  },
                },
              },
            },
          },
        ],
      },
    };
    const both = {
      all: [
        { with: { type: "com.example.a" } },
        { with: { type: "com.example.b" } },
      ],
    };
    await publish(
      t,
      editor,
      aDocument({}, [emits, { both: { listen: { to: both } } }]),
    );
    const { id } = await start(t, editor);
    await drain(t);

    await accept(anEvent("com.example.a", "a-1"));
    await accept(anEvent("com.example.b", "b-1"));
    await relay(t);
    await drain(t);
    const instance = await instanceOf(t, editor, id);

    const consumed = [{ id: "a-1" }, { id: "b-1" }];

    expect(instance.phase).toBe("completed");
    expect(instance.output).toHaveLength(consumed.length);
    expect(instance.output).toEqual(expect.arrayContaining(consumed));
  });

  it("the_same_event_sent_twice_is_consumed_once", async () => {
    const twoOrders = {
      any: [{ with: { type: "order.placed" } }],
      until: "${ length >= 2 }",
    };
    await publish(t, editor, aListeningDocument(twoOrders));
    const { id } = await start(t, editor);
    await drain(t);

    await send(placed("order-1", { total: 1 }));
    await send(placed("order-1", { total: 1 }));

    expect((await instanceOf(t, editor, id)).phase).toBe("waiting");

    await send(placed("order-2", { total: 2 }));

    expect((await instanceOf(t, editor, id)).phase).toBe("completed");
  });
});
