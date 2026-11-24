import type { Transport } from "@codemirror/lsp-client";
import { z } from "zod";

interface Received {
  readonly method: string;
  readonly params: unknown;
}

const INCOMING = z.object({
  id: z.number().optional(),
  method: z.string().optional(),
  params: z.unknown(),
});

interface ScriptedServer {
  readonly transport: Transport;
  readonly received: Received[];
}

export interface Refusal {
  readonly code: number;
  readonly message: string;
}

const NO_REFUSALS: ReadonlyMap<string, Refusal> = new Map();

export function scriptedServer(
  answers: ReadonlyMap<string, unknown>,
  refusals = NO_REFUSALS,
): ScriptedServer {
  const received: Received[] = [];
  const handlers = new Set<(message: string) => void>();

  function deliver(reply: object): void {
    const message = JSON.stringify(reply);
    queueMicrotask(() => {
      for (const handler of handlers) handler(message);
    });
  }

  function answer(message: string): void {
    const parsed: unknown = JSON.parse(message);
    const { id, method, params } = INCOMING.parse(parsed);

    if (method !== undefined) received.push({ method, params });
    if (id === undefined || method === undefined) return;

    const refusal = refusals.get(method);

    if (refusal !== undefined) {
      deliver({ jsonrpc: "2.0", id, error: refusal });
      return;
    }

    const result = answers.get(method) ?? null;
    deliver({ jsonrpc: "2.0", id, result });
  }

  const transport: Transport = {
    send: answer,
    subscribe(handler) {
      handlers.add(handler);
    },
    unsubscribe(handler) {
      handlers.delete(handler);
    },
  };
  return { transport, received };
}
