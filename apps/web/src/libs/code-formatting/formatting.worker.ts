import type {
  Formatting,
  FormattingAnswer,
  FormattingRequest,
} from "./interfaces";
import { formatJavaScript } from "./prettier";
import { formatPython } from "./ruff";

self.addEventListener("message", (event: MessageEvent<FormattingRequest>) => {
  const [port] = event.ports;

  if (port === undefined) return;

  void answer(event.data, port);
});

async function answer(
  request: FormattingRequest,
  port: MessagePort,
): Promise<void> {
  const answered = await answerOf(request);
  port.postMessage(answered);
  port.close();
}

async function answerOf(request: FormattingRequest): Promise<FormattingAnswer> {
  try {
    return await formattingOf(request);
  } catch (error) {
    const message = String(error);
    return { kind: "failed", message };
  }
}

function formattingOf({
  language,
  text,
}: FormattingRequest): Promise<Formatting> {
  switch (language) {
    case "js":
      return formatJavaScript(text);
    case "python":
      return formatPython(text);
  }
}
