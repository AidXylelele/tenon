import type { CodeProblem, ScriptLanguage } from "@/libs/codemirror/interfaces";
import type {
  Formatted,
  Refused,
  WorkerAnswer,
  WorkerRequest,
} from "./interfaces";

interface LanguageTools {
  readonly format: (
    text: string,
    cursor: number,
  ) => Promise<Formatted | Refused>;
  readonly check: (text: string) => Promise<readonly CodeProblem[]>;
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const [port] = event.ports;

  if (port === undefined) return;

  void answer(event.data, port);
});

async function answer(
  request: WorkerRequest,
  port: MessagePort,
): Promise<void> {
  const answered = await answerOf(request);
  port.postMessage(answered);
  port.close();
}

async function answerOf(request: WorkerRequest): Promise<WorkerAnswer> {
  try {
    return await workOf(request);
  } catch (error) {
    const message = String(error);
    return { kind: "failed", message };
  }
}

async function workOf(request: WorkerRequest): Promise<WorkerAnswer> {
  const tools = await toolsOf(request.language);

  switch (request.kind) {
    case "format":
      return tools.format(request.text, request.cursor);
    case "check": {
      const problems = await tools.check(request.text);
      return { kind: "checked", problems };
    }
  }
}

async function toolsOf(language: ScriptLanguage): Promise<LanguageTools> {
  switch (language) {
    case "javascript": {
      const { checkJavaScript, formatJavaScript } = await import("./prettier");
      return { format: formatJavaScript, check: checkJavaScript };
    }
    case "python": {
      const { checkPython, formatPython } = await import("./ruff");
      return { format: formatPython, check: checkPython };
    }
  }
}
