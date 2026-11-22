import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormattingAnswer, FormattingRequest } from "./interfaces";

interface StartedWorker {
  readonly url: URL;
  readonly options: WorkerOptions;
}

const started: StartedWorker[] = [];
const requests: FormattingRequest[] = [];
const workers: EventTarget[] = [];
const answers: FormattingAnswer[] = [];

function scriptedWorker(url: URL, options: WorkerOptions): EventTarget {
  const worker = new EventTarget();
  started.push({ url, options });
  workers.push(worker);

  function postMessage(
    request: FormattingRequest,
    ports: readonly MessagePort[],
  ): void {
    requests.push(request);
    const answer = answers.shift();

    if (answer === undefined) return;

    ports[0]?.postMessage(answer);
  }

  const terminate = vi.fn();
  return Object.assign(worker, { postMessage, terminate });
}

async function freshFormatScript() {
  vi.resetModules();
  const { formatScript } = await import("./format-script");
  return formatScript;
}

describe("formatting a script off the page's thread", () => {
  beforeEach(() => {
    started.length = 0;
    requests.length = 0;
    workers.length = 0;
    answers.length = 0;
    vi.stubGlobal("Worker", scriptedWorker);
  });

  it("the_first_request_starts_one_module_worker_that_later_requests_reuse", async () => {
    const formatScript = await freshFormatScript();
    answers.push(
      { kind: "formatted", text: "a\n" },
      { kind: "formatted", text: "b\n" },
    );

    await formatScript("js", "a");
    await formatScript("python", "b");

    expect(started).toHaveLength(1);
    expect(started[0]?.url.pathname).toMatch(/\/formatting\.worker\.ts$/);
    expect(started[0]?.options).toEqual({ type: "module" });
    expect(requests).toEqual([
      { language: "js", text: "a" },
      { language: "python", text: "b" },
    ]);
  });

  it.each<[string, FormattingAnswer]>([
    ["formatted", { kind: "formatted", text: "x = 1\n" }],
    [
      "refused",
      { kind: "refused", message: "unexpected EOF while parsing", line: 3 },
    ],
  ])(
    "a_%s_answer_of_the_worker_is_the_answer_of_the_request",
    async (_, answer) => {
      const formatScript = await freshFormatScript();
      answers.push(answer);

      const formatting = await formatScript("python", "x=1");

      expect(formatting).toEqual(answer);
    },
  );

  it("a_formatter_that_failed_rejects_the_request_with_its_reason", async () => {
    const formatScript = await freshFormatScript();
    answers.push({ kind: "failed", message: "CompileError: refused" });

    const formatting = formatScript("python", "x=1");

    await expect(formatting).rejects.toThrow(
      new Error("CompileError: refused"),
    );
  });

  it("a_worker_that_stopped_rejects_the_request", async () => {
    const formatScript = await freshFormatScript();
    const formatting = formatScript("js", "a");
    const stop = new ErrorEvent("error", { message: "Script error." });

    workers[0]?.dispatchEvent(stop);

    await expect(formatting).rejects.toThrow("The formatting worker stopped.");
  });

  it("a_worker_that_stopped_is_replaced_on_the_next_request", async () => {
    const formatScript = await freshFormatScript();
    const failed = formatScript("js", "a");
    const stop = new ErrorEvent("error", { message: "Script error." });
    workers[0]?.dispatchEvent(stop);
    await failed.catch(() => undefined);
    answers.push({ kind: "formatted", text: "b\n" });

    const formatting = await formatScript("js", "b");

    expect(started).toHaveLength(2);
    expect(formatting).toEqual({ kind: "formatted", text: "b\n" });
  });
});
