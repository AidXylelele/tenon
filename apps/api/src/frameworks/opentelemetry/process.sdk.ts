import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { ExpressLayerType } from "@opentelemetry/instrumentation-express";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { register } from "import-in-the-middle/register-hooks.mjs";
import { RequestPath } from "./request-path.js";

const instrumentations = getNodeAutoInstrumentations({
  "@opentelemetry/instrumentation-http": {
    ignoreIncomingRequestHook: (request) => {
      const path = new RequestPath(request.url);
      return path.isHealth();
    },
    startIncomingSpanHook: (request) => {
      const path = new RequestPath(request.url);
      const hook = path.isHook();

      if (!hook) return {};

      return { "url.path": path.redacted() };
    },
  },
  "@opentelemetry/instrumentation-express": {
    ignoreLayersType: [ExpressLayerType.MIDDLEWARE, ExpressLayerType.ROUTER],
  },
  "@opentelemetry/instrumentation-undici": {
    startSpanHook: (request) => {
      const address = new URL(request.path, request.origin);
      return {
        "url.full": `${address.origin}${address.pathname}`,
        "url.query": "",
      };
    },
  },
  "@opentelemetry/instrumentation-pg": {
    requireParentSpan: true,
    ignoreConnectSpans: true,
  },
  "@opentelemetry/instrumentation-nestjs-core": { enabled: false },
  "@opentelemetry/instrumentation-router": { enabled: false },
  "@opentelemetry/instrumentation-dns": { enabled: false },
  "@opentelemetry/instrumentation-net": { enabled: false },
});

export const sdk = new NodeSDK({ instrumentations: [instrumentations] });

register();
sdk.start();
