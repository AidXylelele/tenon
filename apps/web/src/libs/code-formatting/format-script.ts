import type { CodeProblem, ScriptLanguage } from "@/libs/codemirror/interfaces";
import type {
  Checked,
  Failed,
  Formatted,
  Formatting,
  Refused,
  WorkerAnswer,
  WorkerRequest,
} from "./interfaces";

export const FORMATTER_NAMES: Readonly<Record<ScriptLanguage, string>> = {
  javascript: "Prettier",
  python: "Ruff",
};

let worker: Worker | null = null;

export function formatScript(
  language: ScriptLanguage,
  text: string,
  cursor: number,
): Promise<Formatting> {
  const request: WorkerRequest = { kind: "format", language, text, cursor };
  return answerTo<Formatted | Refused>(request);
}

export async function checkScript(
  language: ScriptLanguage,
  text: string,
): Promise<readonly CodeProblem[]> {
  const request: WorkerRequest = { kind: "check", language, text };
  const answer = await answerTo<Checked>(request);

  if (answer.kind === "failed") throw new Error(answer.message);

  return answer.problems;
}

function answerTo<Answer extends WorkerAnswer>(
  request: WorkerRequest,
): Promise<Answer | Failed> {
  const formatter = formattingWorker();

  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel();

    function stop(event: ErrorEvent): void {
      port1.close();
      forget(formatter);
      const message = `The formatting worker stopped: ${event.message}`;
      resolve({ kind: "failed", message });
    }

    port1.onmessage = (event: MessageEvent<Answer | Failed>) => {
      formatter.removeEventListener("error", stop);
      port1.close();
      resolve(event.data);
    };
    formatter.addEventListener("error", stop);
    formatter.postMessage(request, [port2]);
  });
}

function formattingWorker(): Worker {
  worker ??= new Worker(new URL("./formatting.worker.ts", import.meta.url), {
    type: "module",
  });
  return worker;
}

function forget(stopped: Worker): void {
  stopped.terminate();

  if (worker === stopped) worker = null;
}
