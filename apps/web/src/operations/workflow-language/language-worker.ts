import type {
  LanguageConnection,
  LanguageServerOptions,
} from "@/libs/language-client/interfaces";
import { connectLanguageServer } from "@/libs/language-client/language-connection";

export function startWorkflowLanguage(
  options: LanguageServerOptions,
): LanguageConnection {
  const worker = new Worker(
    new URL("./language-server.worker.ts", import.meta.url),
    { type: "module" },
  );
  return connectLanguageServer(worker, options);
}
