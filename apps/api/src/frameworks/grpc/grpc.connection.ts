import type { LookupAddress } from "node:dns";
import {
  Client,
  connectivityState,
  credentials,
  type ServiceError,
} from "@grpc/grpc-js";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { LRUCache } from "lru-cache";
import { AddressPolicy } from "../http/address-policy.js";
import { ResponseSizeLimit } from "../http/response-size-limit.js";
import type {
  ChannelAnswer,
  ChannelCall,
  FailedAnswer,
  MessageCheck,
  ServiceAddress,
} from "./interfaces.js";

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

  async serviceOf(
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

  unary(
    service: ServiceAddress,
    call: ChannelCall,
    signal: AbortSignal,
  ): Promise<ChannelAnswer> {
    const channel = this.#channelFor(service);
    const method = call.method;
    return new Promise((resolve) => {
      const unary = channel.makeUnaryRequest(
        method.path,
        method.requestSerialize,
        method.responseDeserialize,
        call.argument,
        call.metadata,
        call.options,
        (error, message) => {
          signal.removeEventListener("abort", cancel);

          if (error !== null) {
            const failed = this.#failedOf(error, channel);
            resolve(failed);
            return;
          }

          resolve({ kind: "message", message });
        },
      );
      const cancel = (): void => {
        unary.cancel();
      };
      signal.addEventListener("abort", cancel, { once: true });
    });
  }

  streamed(
    service: ServiceAddress,
    call: ChannelCall,
    signal: AbortSignal,
    admits: MessageCheck,
  ): Promise<ChannelAnswer> {
    const channel = this.#channelFor(service);
    const method = call.method;
    const stream = channel.makeServerStreamRequest(
      method.path,
      method.requestSerialize,
      method.responseDeserialize,
      call.argument,
      call.metadata,
      call.options,
    );
    const messages: object[] = [];
    return new Promise((resolve) => {
      const cancel = (): void => {
        stream.cancel();
      };
      signal.addEventListener("abort", cancel, { once: true });
      stream.on("data", (message: object) => {
        const admitted = admits(message);

        if (admitted) {
          messages.push(message);
          return;
        }

        resolve({ kind: "stopped" });
        stream.cancel();
      });
      stream.on("error", (error: ServiceError) => {
        signal.removeEventListener("abort", cancel);
        const failed = this.#failedOf(error, channel);
        resolve(failed);
      });
      stream.on("end", () => {
        signal.removeEventListener("abort", cancel);
        resolve({ kind: "messages", messages });
      });
    });
  }

  onApplicationShutdown(): void {
    this.channels.clear();
  }

  #failedOf(error: ServiceError, channel: Client): FailedAnswer {
    const state = channel.getChannel().getConnectivityState(false);
    const connected = state === connectivityState.READY;
    return { kind: "failed", error, connected };
  }

  #targetOf(address: LookupAddress, port: number): string {
    const at = String(port);

    if (address.family === 6) return `ipv6:[${address.address}]:${at}`;

    return `ipv4:${address.address}:${at}`;
  }

  #channelFor(service: ServiceAddress): Client {
    const key = `${service.target} ${service.host}`;
    return this.channels.memo(key, { context: service });
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
