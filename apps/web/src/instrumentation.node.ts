import { HostMetricsInstrumentation } from "@opentelemetry/instrumentation-host-metrics";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { NodeSDK } from "@opentelemetry/sdk-node";

const sdk = new NodeSDK({
  serviceName: "tenon-web",
  instrumentations: [
    new UndiciInstrumentation(),
    new HostMetricsInstrumentation({
      metricGroups: ["process.cpu", "process.memory"],
    }),
  ],
});

sdk.start();

process.once("SIGTERM", () => void sdk.shutdown());
