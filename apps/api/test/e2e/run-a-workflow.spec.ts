import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Api } from "./support/api.js";

const ENDED = ["completed", "faulted", "cancelled"];

describe("journey: publish a workflow, run it and see it complete", () => {
  const api = new Api();
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const namespace = `journey-${suffix}`;
  let quotes: Server;
  let origin = "";

  beforeAll(async () => {
    quotes = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ price: 42 }));
    });
    await new Promise<void>((resolve) => quotes.listen(0, "0.0.0.0", resolve));
    const address = quotes.address() as AddressInfo;
    origin = `http://host.docker.internal:${String(address.port)}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) =>
      quotes.close(() => {
        resolve();
      }),
    );
    await api.mailpit.cleanup();
  });

  it("a_workflow_that_calls_an_endpoint_and_waits_on_a_timer_completes_with_its_output", async () => {
    const { cookie } = await api.inviteAndAccept("editor");
    const quote = {
      document: { dsl: "1.1.0", namespace, name: "quote", version: "1.0.0" },
      do: [
        {
          price: {
            call: "http",
            with: { method: "get", endpoint: "${ .quotes }" },
            output: { as: "${ { price: .price } }" },
          },
        },
        { pause: { wait: { seconds: 2 } } },
        { total: { set: { total: "${ .price * 2 }" } } },
      ],
    };

    const draft = `/api/v1/workflows/${namespace}/quote/draft`;
    const drafted = await api.call(draft, {
      method: "PUT",
      cookie,
      headers: { "if-none-match": "*" },
      body: { source: JSON.stringify(quote), layout: {} },
    });
    expect(drafted.status).toBe(201);

    const published = await api.call(draft, {
      method: "POST",
      cookie,
      headers: { "if-match": drafted.headers.get("etag") ?? "" },
      body: quote,
    });
    expect(published.status).toBe(201);

    const started = await api.call(
      `/api/v1/workflows/${namespace}/quote/instances`,
      {
        method: "POST",
        cookie,
        body: { input: { quotes: `${origin}/quote` } },
      },
    );
    expect(started.status).toBe(201);
    const run = (await started.json()) as { id: string };

    const waiting = await api.instanceIn(run.id, cookie, ["waiting", ...ENDED]);
    expect(waiting.phase).toBe("waiting");

    const done = await api.instanceIn(run.id, cookie, ENDED);
    expect(done).toMatchObject({ phase: "completed", output: { total: 84 } });

    const tasks = await api.call(`/api/v1/instances/${run.id}/tasks`, {
      cookie,
    });
    const records = (await tasks.json()) as {
      items: { name: string; status: string }[];
    };
    expect(records.items.map((task) => `${task.name}:${task.status}`)).toEqual([
      "price:completed",
      "pause:completed",
      "total:completed",
    ]);

    await api.call("/api/v1/auth/session", { method: "DELETE", cookie });
  }, 120_000);
});
