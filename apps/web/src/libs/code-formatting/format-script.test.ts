import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CodeProblem } from "@/libs/codemirror/interfaces";
import type { WorkerAnswer, WorkerRequest } from "./interfaces";

interface StartedWorker {
  readonly url: URL;
  readonly options: WorkerOptions;
}

const started: StartedWorker[] = [];
const requests: WorkerRequest[] = [];
const workers: EventTarget[] = [];
const answers: WorkerAnswer[] = [];

function scriptedWorker(url: URL, options: WorkerOptions): EventTarget {
  const worker = new EventTarget();
  started.push({ url, options });
  workers.push(worker);

  function postMessage(
    request: WorkerRequest,
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

async function freshScripts() {
  vi.resetModules();
  return import("./format-script");
}

describe("formatting and checking a script off the page's thread", () => {
  beforeEach(() => {
    started.length = 0;
    requests.length = 0;
    workers.length = 0;
    answers.length = 0;
    vi.stubGlobal("Worker", scriptedWorker);
  });

  it("the_first_request_starts_one_module_worker_that_later_requests_reuse", async () => {
    const { checkScript, formatScript } = await freshScripts();
    answers.push(
      { kind: "formatted", text: "a\n", cursor: 0 },
      { kind: "checked", problems: [] },
    );

    await formatScript("javascript", "a", 0);
    await checkScript("python", "b");

    expect(started).toHaveLength(1);
    expect(started[0]?.url.pathname).toMatch(/\/formatting\.worker\.ts$/);
    expect(started[0]?.options).toEqual({ type: "module" });
    expect(requests).toEqual([
      { kind: "format", language: "javascript", text: "a", cursor: 0 },
      { kind: "check", language: "python", text: "b" },
    ]);
  });

  it.each<[string, WorkerAnswer]>([
    ["formatted", { kind: "formatted", text: "x = 1\n", cursor: 5 }],
    [
      "refused",
      { kind: "refused", message: "unexpected EOF while parsing", line: 3 },
    ],
    ["failed", { kind: "failed", message: "CompileError: refused" }],
  ])("a_%s_answer_of_the_worker_is_the_formatting", async (_, answer) => {
    const { formatScript } = await freshScripts();
    answers.push(answer);

    const formatting = await formatScript("python", "x=1", 3);

    expect(formatting).toEqual(answer);
  });

  it("a_check_resolves_the_problems_by_line", async () => {
    const { checkScript } = await freshScripts();
    const problems: readonly CodeProblem[] = [
      { line: 3, message: "unexpected EOF while parsing", severity: "error" },
    ];
    answers.push({ kind: "checked", problems });

    const checked = await checkScript("python", "x = (");

    expect(checked).toEqual(problems);
  });

  it("a_check_that_could_not_run_rejects_with_the_reason", async () => {
    const { checkScript } = await freshScripts();
    answers.push({ kind: "failed", message: "CompileError: refused" });

    const checked = checkScript("python", "x = 1");

    await expect(checked).rejects.toThrow(new Error("CompileError: refused"));
  });

  it("every_pending_formatting_fails_when_the_worker_stops", async () => {
    const { formatScript } = await freshScripts();
    const first = formatScript("javascript", "a", 0);
    const second = formatScript("python", "b", 0);
    const stop = new ErrorEvent("error", { message: "Script error." });

    workers[0]?.dispatchEvent(stop);

    const firstFailed = await first;
    const secondFailed = await second;
    const stopped = {
      kind: "failed",
      message: "The formatting worker stopped: Script error.",
    };
    expect(firstFailed).toEqual(stopped);
    expect(secondFailed).toEqual(stopped);
  });

  it("a_worker_that_stopped_is_replaced_on_the_next_request", async () => {
    const { formatScript } = await freshScripts();
    const failed = formatScript("javascript", "a", 0);
    const stop = new ErrorEvent("error", { message: "Script error." });
    workers[0]?.dispatchEvent(stop);
    await failed;
    answers.push({ kind: "formatted", text: "b\n", cursor: 0 });

    const formatting = await formatScript("javascript", "b", 0);

    expect(started).toHaveLength(2);
    expect(formatting).toEqual({ kind: "formatted", text: "b\n", cursor: 0 });
  });

  it("each_language_names_its_formatter", async () => {
    const { FORMATTER_NAMES } = await freshScripts();

    expect(FORMATTER_NAMES).toEqual({ javascript: "Prettier", python: "Ruff" });
  });
});
