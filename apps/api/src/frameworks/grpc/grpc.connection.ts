import type { LookupAddress } from "node:dns";
import { Client, credentials } from "@grpc/grpc-js";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { LRUCache } from "lru-cache";
import { AddressPolicy } from "../network/address-policy.js";
import { ResponseSizeLimit } from "../network/response-size-limit.js";
import type { ServiceAddress, ServiceChannel } from "./interfaces.js";

@Injectable()
export class GrpcConnection implements OnApplicationShutdown {
  private static readonly DEFAULT_PORT = 443;
  private static readonly CHANNEL_LIMIT = 64;
  private static readonly CHANNEL_IDLE_TIMEOUT = 5 * 60 * 1_000;

  private readonly channels = new LRUCache<string, Client, ServiceAddress>({
    max: GrpcConnection.CHANNEL_LIMIT,
    ttl: GrpcConnection.CHANNEL_IDLE_TIMEOUT,
    ttlAutopurge: true,
    updateAgeOnGet: true,
    memoMethod: (_key, _stale, { context }) => this.#channelOf(context),
    dispose: (channel) => {
      channel.close();
    },
  });

  constructor(
    private readonly addresses: AddressPolicy,
    private readonly limit: ResponseSizeLimit,
  ) {}

  async channelTo(
    host: string,
    port: number | null,
  ): Promise<ServiceChannel | null> {
    const service = await this.#serviceOf(host, port);

    if (service === null) return null;

    const key = `${service.target} ${service.host}`;
    const client = this.channels.memo(key, { context: service });
    return { client, plaintext: service.plaintext };
  }

  onApplicationShutdown(): void {
    this.channels.clear();
  }

  async #serviceOf(
    host: string,
    given: number | null,
  ): Promise<ServiceAddress | null> {
    const port = given ?? GrpcConnection.DEFAULT_PORT;
    const [resolved] = await this.addresses.resolve(host, 0);

    if (resolved === undefined) return null;

    const target = this.#targetOf(resolved, port);
    const privateAddress = this.addresses.isPrivate(resolved.address);
    const tlsPort = port === GrpcConnection.DEFAULT_PORT;
    const plaintext = privateAddress && !tlsPort;
    return { target, host, port, plaintext };
  }

  #targetOf(address: LookupAddress, port: number): string {
    const at = String(port);

    if (address.family === 6) return `ipv6:[${address.address}]:${at}`;

    return `ipv4:${address.address}:${at}`;
  }

  #channelOf(service: ServiceAddress): Client {
    const security = service.plaintext
      ? credentials.createInsecure()
      : credentials.createSsl();
    const authority = `${service.host}:${String(service.port)}`;
    return new Client(service.target, security, {
      "grpc.default_authority": authority,
      "grpc.ssl_target_name_override": service.host,
      "grpc.enable_http_proxy": 0,
      "grpc.enable_retries": 0,
      "grpc.max_receive_message_length": this.limit.bytes,
      "grpc.service_config_disable_resolution": 1,
    });
  }
}
