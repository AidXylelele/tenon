import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { NodeSDK } from "@opentelemetry/sdk-node";

@Injectable()
export class OpenTelemetryShutdown implements OnApplicationShutdown {
  constructor(private readonly sdk: NodeSDK) {}

  async onApplicationShutdown(): Promise<void> {
    await this.sdk.shutdown();
  }
}
