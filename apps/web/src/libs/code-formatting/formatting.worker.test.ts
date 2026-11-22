import { describe, expect, it, vi } from "vitest";
import type { FormattingAnswer, FormattingRequest } from "./interfaces";
import "./formatting.worker";

function answerTo(request: FormattingRequest): Promise<FormattingAnswer> {
  const { port1, port2 } = new MessageChannel();
  const answered = new Promise<FormattingAnswer>((resolve) => {
    port1.onmessage = (event: MessageEvent<FormattingAnswer>) => {
      port1.close();
      resolve(event.data);
    };
  });
  const message = new MessageEvent("message", {
    data: request,
    ports: [port2],
  });
  self.dispatchEvent(message);
  return answered;
}

function missing(): Promise<Response> {
  const response = new Response(null, { status: 404 });
  return Promise.resolve(response);
}

describe("the formatting worker answering through each request's port", () => {
  it("a_javascript_request_is_answered_with_prettiers_formatting", async () => {
    const answer = await answerTo({ language: "javascript", text: "a=1" });

    expect(answer).toEqual({ kind: "formatted", text: "a = 1;\n" });
  });

  it("a_python_request_is_answered_failed_with_the_reason_ruff_cannot_start", async () => {
    vi.stubGlobal("fetch", missing);

    const answer = await answerTo({ language: "python", text: "a=1" });

    const reason: unknown = expect.any(String);
    expect(answer).toEqual({ kind: "failed", message: reason });
  });

  it("a_request_without_a_port_is_dropped_and_the_next_is_answered", async () => {
    const portless = new MessageEvent("message", {
      data: { language: "javascript", text: "a=1" },
    });
    self.dispatchEvent(portless);

    const answer = await answerTo({ language: "javascript", text: "b=2" });

    expect(answer).toEqual({ kind: "formatted", text: "b = 2;\n" });
  });
});
