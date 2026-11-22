import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { NodeSDK } from "@opentelemetry/sdk-node";

const runtime = new RuntimeNodeInstrumentation();

export const sdk = new NodeSDK({ instrumentations: [runtime] });

sdk.start();
