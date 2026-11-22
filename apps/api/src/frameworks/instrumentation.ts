import { isMainThread } from "node:worker_threads";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { register } from "import-in-the-middle/register-hooks.mjs";

const instrumentations = getNodeAutoInstrumentations({
  "@opentelemetry/instrumentation-undici": {
    startSpanHook: (request) => {
      const address = new URL(request.path, request.origin);
      return {
        "url.full": `${address.origin}${address.pathname}`,
        "url.query": "",
      };
    },
  },
  "@opentelemetry/instrumentation-pg": { requireParentSpan: true },
});

export const sdk = new NodeSDK({
  serviceName: "tenon-api",
  instrumentations: [instrumentations],
});

if (isMainThread) {
  register();
  sdk.start();
}
