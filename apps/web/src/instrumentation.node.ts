import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { NodeSDK } from "@opentelemetry/sdk-node";

const sdk = new NodeSDK({
  serviceName: "tenon-web",
  instrumentations: [new UndiciInstrumentation()],
});

sdk.start();

process.once("SIGTERM", () => void sdk.shutdown());
