import { describe, expect, it, vi } from "vitest";
import type { WorkerAnswer, WorkerRequest } from "./interfaces";
import "./formatting.worker";
import { missing } from "./wasm-fetch.test-support";

function answerTo(request: WorkerRequest): Promise<WorkerAnswer> {
  const { port1, port2 } = new MessageChannel();
  const answered = new Promise<WorkerAnswer>((resolve) => {
    port1.onmessage = (event: MessageEvent<WorkerAnswer>) => {
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

describe("the formatting worker answering through each request's port", () => {
  it("a_javascript_request_is_answered_with_prettiers_formatting", async () => {
    const answer = await answerTo({
      kind: "format",
      language: "javascript",
      text: "a=1",
      cursor: 0,
    });

    expect(answer).toEqual({ kind: "formatted", text: "a = 1;\n", cursor: 0 });
  });

  it("a_python_request_is_answered_failed_with_the_reason_ruff_cannot_start", async () => {
    vi.stubGlobal("fetch", missing);

    const answer = await answerTo({
      kind: "format",
      language: "python",
      text: "a=1",
      cursor: 0,
    });

    const reason: unknown = expect.any(String);
    expect(answer).toEqual({ kind: "failed", message: reason });
  });

  it("a_request_without_a_port_is_dropped_and_the_next_is_answered", async () => {
    const portless = new MessageEvent("message", {
      data: { kind: "format", language: "javascript", text: "a=1", cursor: 0 },
    });
    self.dispatchEvent(portless);

    const answer = await answerTo({
      kind: "format",
      language: "javascript",
      text: "b=2",
      cursor: 0,
    });

    expect(answer).toEqual({ kind: "formatted", text: "b = 2;\n", cursor: 0 });
  });

  it("a_check_request_is_answered_with_the_problems_by_line", async () => {
    const answer = await answerTo({
      kind: "check",
      language: "javascript",
      text: "const a = (1;",
    });

    expect(answer).toEqual({
      kind: "checked",
      problems: [
        {
          line: 1,
          message: 'Unexpected token, expected "," (1:13)',
          severity: "error",
        },
      ],
    });
  });
});
