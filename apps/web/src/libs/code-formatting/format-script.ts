import type { ScriptLanguage } from "@/libs/codemirror/interfaces";
import type {
  Formatting,
  FormattingAnswer,
  FormattingRequest,
} from "./interfaces";

let worker: Worker | null = null;

export function formatScript(
  language: ScriptLanguage,
  text: string,
): Promise<Formatting> {
  const formatter = formattingWorker();
  const request: FormattingRequest = { language, text };

  return new Promise((resolve, reject) => {
    const { port1, port2 } = new MessageChannel();

    function stop(event: ErrorEvent): void {
      port1.close();
      forget(formatter);
      const stopped = new Error("The formatting worker stopped.", {
        cause: event,
      });
      reject(stopped);
    }

    port1.onmessage = (event: MessageEvent<FormattingAnswer>) => {
      formatter.removeEventListener("error", stop);
      port1.close();
      const answer = event.data;

      if (answer.kind === "failed") {
        const failed = new Error(answer.message);
        reject(failed);
        return;
      }

      resolve(answer);
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
