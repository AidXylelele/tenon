import { describe, expect, it, vi } from "vitest";
import { startWorkflowLanguage } from "./language-worker";

interface StartedWorker {
  readonly url: URL;
  readonly options: WorkerOptions;
  readonly terminate: () => void;
}

const started: StartedWorker[] = [];

vi.stubGlobal("Worker", function (url: URL, options: WorkerOptions) {
  const terminate = vi.fn();
  started.push({ url, options, terminate });
  const worker = new EventTarget();
  const postMessage = vi.fn();
  return Object.assign(worker, { postMessage, terminate });
});

const OPTIONS = {
  initializationOptions: {},
  extensions: [],
  notificationHandlers: {},
};

describe("the workflow language started in its own worker", () => {
  it("the_language_server_runs_in_its_module_worker_until_closed", () => {
    const language = startWorkflowLanguage(OPTIONS);

    language.close();

    expect(started).toHaveLength(1);
    expect(started[0]?.url.pathname).toMatch(/\/language-server\.worker\.ts$/);
    expect(started[0]?.options).toEqual({ type: "module" });
    expect(started[0]?.terminate).toHaveBeenCalledOnce();
  });
});
