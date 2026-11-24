import { LSPClient, type Transport } from "@codemirror/lsp-client";
import type { LanguageConnection, LanguageServerOptions } from "./interfaces";

const REQUEST_TIMEOUT_MS = 15_000;

type Listener = (event: MessageEvent<unknown>) => void;

export function connectLanguageServer(
  worker: Worker,
  options: LanguageServerOptions,
): LanguageConnection {
  const transport = workerTransport(worker);
  const client = new LSPClient({
    initializationOptions: options.initializationOptions,
    extensions: options.extensions,
    notificationHandlers: options.notificationHandlers,
    timeout: REQUEST_TIMEOUT_MS,
  }).connect(transport);

  function close() {
    client.disconnect();
    worker.terminate();
  }

  return { client, close };
}

function workerTransport(worker: Worker): Transport {
  const listeners = new Map<(value: string) => void, Listener>();

  return {
    send(message) {
      const parsed: unknown = JSON.parse(message);
      worker.postMessage(parsed);
    },
    subscribe(handler) {
      const listener: Listener = (event) => {
        const message = JSON.stringify(event.data);
        handler(message);
      };
      listeners.set(handler, listener);
      worker.addEventListener("message", listener);
    },
    unsubscribe(handler) {
      const listener = listeners.get(handler);

      if (listener === undefined) return;

      worker.removeEventListener("message", listener);
      listeners.delete(handler);
    },
  };
}
