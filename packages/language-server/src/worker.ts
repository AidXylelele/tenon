import { type Analyzer, createAnalyzer } from "interpreter/front-end";
import engineUrl from "jq-wasm/jq.wasm";
import { serve } from "./lsp/index.js";

export function startServer(scope: DedicatedWorkerGlobalScope): void {
  serve(scope, analyzerOfFetchedEngine);
}

async function analyzerOfFetchedEngine(): Promise<Analyzer> {
  const lacksTemporal = !("Temporal" in globalThis);
  const polyfill = lacksTemporal ? import("temporal-polyfill/global") : null;
  const download = fetch(engineUrl);
  const [response] = await Promise.all([download, polyfill]);

  if (!response.ok) {
    const status = String(response.status);
    const reason = `The expression engine's download failed with HTTP status ${status}.`;

    throw new Error(reason);
  }

  const bytes = await response.arrayBuffer();
  const engine = new Uint8Array(bytes);

  return createAnalyzer(engine);
}
