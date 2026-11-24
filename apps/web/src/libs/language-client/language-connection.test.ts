import { afterEach, describe, expect, it, vi } from "vitest";
import { connectLanguageServer } from "./language-connection";

interface Message {
  readonly id?: number;
  readonly method?: string;
}

const channels: MessageChannel[] = [];

function serverOn(port: MessagePort, answers: Record<string, unknown>) {
  const seen: string[] = [];
  port.addEventListener("message", (event: MessageEvent<Message>) => {
    const { id, method } = event.data;

    if (method !== undefined) seen.push(method);

    if (id === undefined || method === undefined) return;

    port.postMessage({ jsonrpc: "2.0", id, result: answers[method] ?? null });
  });
  port.start();
  return seen;
}

describe("a language server reached over a message port", () => {
  afterEach(() => {
    for (const channel of channels) {
      channel.port1.close();
      channel.port2.close();
    }
  });

  it("initializes_then_answers_a_request_with_plain_json", async () => {
    const channel = new MessageChannel();
    channels.push(channel);
    const seen = serverOn(channel.port2, {
      initialize: { capabilities: {} },
      "workflow/newDocument": { kind: "text", text: "do: []\n" },
    });
    channel.port1.start();
    const { client } = connectLanguageServer(
      channel.port1 as unknown as Worker,
      { initializationOptions: null, extensions: [], notificationHandlers: {} },
    );

    await client.initializing;
    const answer = await client.request("workflow/newDocument", {});

    expect(answer).toEqual({ kind: "text", text: "do: []\n" });
    expect(seen.slice(0, 2)).toEqual(["initialize", "initialized"]);
  });

  it("closing_stops_listening_and_ends_the_worker", () => {
    const channel = new MessageChannel();
    channels.push(channel);
    const terminate = vi.fn();
    const worker = Object.assign(channel.port1, { terminate });
    const removed = vi.spyOn(channel.port1, "removeEventListener");
    const connection = connectLanguageServer(worker as unknown as Worker, {
      initializationOptions: null,
      extensions: [],
      notificationHandlers: {},
    });

    connection.close();

    expect(removed).toHaveBeenCalledWith("message", expect.any(Function));
    expect(terminate).toHaveBeenCalledOnce();
  });
});
