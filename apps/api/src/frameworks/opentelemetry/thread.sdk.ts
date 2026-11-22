import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { NodeSDK } from "@opentelemetry/sdk-node";

export const sdk = new NodeSDK({
  instrumentations: [new RuntimeNodeInstrumentation()],
});

sdk.start();
