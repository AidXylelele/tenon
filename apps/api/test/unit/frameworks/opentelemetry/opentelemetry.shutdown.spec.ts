import { NodeSDK } from "@opentelemetry/sdk-node";
import { OpenTelemetryShutdown } from "../../../../src/frameworks/opentelemetry/opentelemetry.shutdown.js";

describe("the OpenTelemetry shutdown", () => {
  it("the_sdk_is_shut_down_once_nest_shuts_the_application_down", async () => {
    const sdk = new NodeSDK({ instrumentations: [] });
    const shutdown = vi.spyOn(sdk, "shutdown").mockResolvedValue();

    await new OpenTelemetryShutdown(sdk).onApplicationShutdown();

    expect(shutdown).toHaveBeenCalledOnce();
  });
});
