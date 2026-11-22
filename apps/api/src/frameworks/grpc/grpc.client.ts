import type { LookupAddress } from "node:dns";
import {
  type CallOptions,
  Client,
  connectivityState,
  credentials,
  Metadata,
  type ServiceError,
  status,
} from "@grpc/grpc-js";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import {
  ResilienceError,
  type ResiliencePolicy,
  ResilienceService,
  ResilienceTimeoutError,
} from "@nestjs/resilience";
import type { GrpcOutcome, GrpcRequest, JsonValue } from "interpreter";
import ipaddr from "ipaddr.js";
import { LRUCache } from "lru-cache";
import { AddressPolicy } from "../http-client/address-policy.js";
import { HttpAuthentication } from "../http-client/http-authentication.js";
import type { Authorization } from "../http-client/interfaces.js";
import { HttpClient } from "../http-client/http.client.js";
import type { CallContext } from "../interpreter/interfaces.js";
import type { PreparedCall, ServiceAddress } from "./interfaces.js";
import { ProtoSchema } from "./proto-schema.js";

const DEFAULT_PORT = 443;

const CHANNEL_LIMIT = 64;

const CHANNEL_IDLE_TIMEOUT = 5 * 60 * 1_000;

@Injectable()
export class GrpcClient implements OnApplicationShutdown {
  private readonly policy: ResiliencePolicy;
  private readonly channels = new LRUCache<string, Client, ServiceAddress>({
    max: CHANNEL_LIMIT,
    ttl: CHANNEL_IDLE_TIMEOUT,
    ttlAutopurge: true,
    updateAgeOnGet: true,
    memoMethod: (_key, _stale, { context }) => this.#channelOf(context),
    dispose: (channel) => {
      channel.close();
    },
  });

  constructor(
    private readonly addresses: AddressPolicy,
    private readonly http: HttpClient,
    private readonly authentication: HttpAuthentication,
    private readonly schema: ProtoSchema,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("grpc-calls");
  }

  async call(request: GrpcRequest, context: CallContext): Promise<GrpcOutcome> {
    const proto = await this.http.text(request.proto, context);

    if (proto.kind !== "text") return proto;

    const prepared = this.schema.preparedOf(proto.text, request);

    if (prepared.kind === "misconfigured") return prepared;

    try {
      return await this.policy.execute(
        (attempt) => this.#called(request, prepared, context, attempt.signal),
        { signal: context.signal },
      );
    } catch (error) {
      return this.#failureOf(error, context.signal);
    }
  }

  onApplicationShutdown(): void {
    this.channels.clear();
  }

  async #called(
    request: GrpcRequest,
    prepared: PreparedCall,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<GrpcOutcome> {
    const service = await this.#serviceOf(request);

    if (service === null)
      return {
        kind: "unreachable",
        detail: "The host name could not be resolved",
      };

    if (service.plaintext && request.authentication !== null)
      return {
        kind: "misconfigured",
        detail:
          "Credentials are not sent to a gRPC service over a plaintext channel",
      };

    const authorization = await this.authentication.authorizationOf(
      request.authentication,
      context.secrets,
      signal,
    );

    if (authorization.kind === "forbidden") return authorization;

    if (authorization.kind === "misconfigured") return authorization;

    if (authorization.kind === "digest")
      return {
        kind: "unauthenticated",
        detail:
          "Digest authentication answers an HTTP challenge, which a gRPC call never receives",
      };

    signal.throwIfAborted();
    const channel = this.#channelFor(service);
    const metadata = this.#metadataOf(context.idempotencyKey, authorization);
    const options = this.#optionsOf(context.remaining);

    if (prepared.method.responseStream)
      return this.#streamed(channel, prepared, metadata, options, signal);

    return this.#unary(channel, prepared, metadata, options, signal);
  }

  async #serviceOf(request: GrpcRequest): Promise<ServiceAddress | null> {
    const host = request.service.host;
    const port = request.service.port ?? DEFAULT_PORT;
    const [resolved] = await this.addresses.resolve(host, 0);

    if (resolved === undefined) return null;

    const target = this.#targetOf(resolved, port);
    const plaintext = this.#isPrivate(resolved);
    return { target, host, port, plaintext };
  }

  #targetOf(address: LookupAddress, port: number): string {
    const at = String(port);

    if (address.family === 6) return `ipv6:[${address.address}]:${at}`;

    return `ipv4:${address.address}:${at}`;
  }

  #isPrivate(address: LookupAddress): boolean {
    const parsed = ipaddr.process(address.address);
    return parsed.range() !== "unicast";
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
      "grpc.max_receive_message_length": HttpClient.RESPONSE_BYTES,
      "grpc.service_config_disable_resolution": 1,
    });
  }

  #metadataOf(
    idempotencyKey: string,
    authorization: Extract<Authorization, { kind: "anonymous" | "header" }>,
  ): Metadata {
    const metadata = new Metadata();
    metadata.set("idempotency-key", idempotencyKey);

    if (authorization.kind === "header") {
      const header = authorization.header;
      metadata.set("authorization", `${header.scheme} ${header.parameter}`);
    }

    return metadata;
  }

  #optionsOf(remaining: number | null): CallOptions {
    if (remaining === null) return {};

    return { deadline: Date.now() + remaining };
  }

  #unary(
    channel: Client,
    prepared: PreparedCall,
    metadata: Metadata,
    options: CallOptions,
    signal: AbortSignal,
  ): Promise<GrpcOutcome> {
    const method = prepared.method;
    return new Promise((resolve, reject) => {
      const call = channel.makeUnaryRequest(
        method.path,
        method.requestSerialize,
        method.responseDeserialize,
        prepared.argument,
        metadata,
        options,
        (error, response) => {
          signal.removeEventListener("abort", cancel);

          if (error !== null && signal.aborted) {
            reject(error);
            return;
          }

          if (error !== null) {
            const answer = this.#statusOf(error, channel);
            resolve(answer);
            return;
          }

          const message = this.#jsonOf(response);
          resolve({ kind: "replied", message });
        },
      );
      const cancel = (): void => {
        call.cancel();
      };
      signal.addEventListener("abort", cancel, { once: true });
    });
  }

  #streamed(
    channel: Client,
    prepared: PreparedCall,
    metadata: Metadata,
    options: CallOptions,
    signal: AbortSignal,
  ): Promise<GrpcOutcome> {
    const method = prepared.method;
    return new Promise((resolve, reject) => {
      const stream = channel.makeServerStreamRequest(
        method.path,
        method.requestSerialize,
        method.responseDeserialize,
        prepared.argument,
        metadata,
        options,
      );
      const cancel = (): void => {
        stream.cancel();
      };
      const messages: JsonValue[] = [];
      let received = 0;
      signal.addEventListener("abort", cancel, { once: true });
      stream.on("data", (message: object) => {
        const json = this.#jsonOf(message);
        const text = JSON.stringify(json);
        received += Buffer.byteLength(text);

        if (received > HttpClient.RESPONSE_BYTES) {
          resolve({
            kind: "status",
            code: status.RESOURCE_EXHAUSTED,
            message: "The response is larger than 1 MiB",
          });
          stream.cancel();
          return;
        }

        messages.push(json);
      });
      stream.on("error", (error: ServiceError) => {
        signal.removeEventListener("abort", cancel);

        if (signal.aborted) {
          reject(error);
          return;
        }

        const answer = this.#statusOf(error, channel);
        resolve(answer);
      });
      stream.on("end", () => {
        signal.removeEventListener("abort", cancel);
        resolve({ kind: "replied", message: messages });
      });
    });
  }

  #statusOf(error: ServiceError, channel: Client): GrpcOutcome {
    const state = channel.getChannel().getConnectivityState(false);
    const unconnected =
      error.code === status.UNAVAILABLE && state !== connectivityState.READY;

    if (unconnected)
      return {
        kind: "unreachable",
        detail: "The service could not be reached",
      };

    return { kind: "status", code: error.code, message: error.details };
  }

  #jsonOf(message: object | undefined): JsonValue {
    const text = JSON.stringify(message ?? null);
    return JSON.parse(text) as JsonValue;
  }

  #failureOf(error: unknown, signal: AbortSignal): GrpcOutcome {
    if (signal.aborted || error instanceof ResilienceTimeoutError)
      return { kind: "expired" };

    if (error instanceof ResilienceError) throw error;

    const failure = this.http.transportFailureOf(error);

    if (failure === null) throw error;

    return failure;
  }
}
