import type { LookupAddress } from "node:dns";
import {
  type CallOptions,
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
import { AddressPolicy } from "../http-client/address-policy.js";
import { HttpAuthentication } from "../http-client/http-authentication.js";
import type { Authorization } from "../http-client/interfaces.js";
import { HttpClient } from "../http-client/http.client.js";
import type { CallContext } from "../interpreter/interfaces.js";
import type {
  PreparedCall,
  ServerStreamMethod,
  ServiceClient,
  UnaryMethod,
} from "./interfaces.js";
import { ProtoSchema } from "./proto-schema.js";

const TLS_PORT = 443;

@Injectable()
export class GrpcClient implements OnApplicationShutdown {
  private readonly policy: ResiliencePolicy;
  private readonly clients = new Map<string, ServiceClient>();

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
    const port = request.service.port ?? TLS_PORT;

    if (request.authentication !== null && port !== TLS_PORT)
      return {
        kind: "misconfigured",
        detail:
          "Credentials are not sent to a gRPC service over a plaintext channel",
      };

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
    for (const client of this.clients.values()) client.close();
  }

  async #called(
    request: GrpcRequest,
    prepared: PreparedCall,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<GrpcOutcome> {
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

    const [address] = await this.addresses.resolve(request.service.host, 0);

    if (address === undefined)
      return {
        kind: "unreachable",
        detail: "The host name could not be resolved",
      };

    signal.throwIfAborted();
    const client = this.#clientOf(request, prepared, address);
    const metadata = this.#metadataOf(context.idempotencyKey, authorization);
    const options = this.#optionsOf(context.remaining);

    if (prepared.streamed)
      return this.#streamed(client, prepared, metadata, options, signal);

    return this.#unary(client, prepared, metadata, options, signal);
  }

  #clientOf(
    request: GrpcRequest,
    prepared: PreparedCall,
    address: LookupAddress,
  ): ServiceClient {
    const host = request.service.host;
    const port = request.service.port ?? TLS_PORT;
    const target =
      address.family === 6
        ? `ipv6:[${address.address}]:${String(port)}`
        : `ipv4:${address.address}:${String(port)}`;
    const key = `${prepared.digest} ${request.service.name} ${target} ${host}`;
    const cached = this.clients.get(key);

    if (cached !== undefined) return cached;

    const security =
      port === TLS_PORT
        ? credentials.createSsl()
        : credentials.createInsecure();
    const client = new prepared.service(target, security, {
      "grpc.default_authority": `${host}:${String(port)}`,
      "grpc.ssl_target_name_override": host,
      "grpc.enable_http_proxy": 0,
      "grpc.enable_retries": 0,
      "grpc.max_receive_message_length": HttpClient.RESPONSE_BYTES,
      "grpc.service_config_disable_resolution": 1,
    });
    this.clients.set(key, client);
    return client;
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
    client: ServiceClient,
    prepared: PreparedCall,
    metadata: Metadata,
    options: CallOptions,
    signal: AbortSignal,
  ): Promise<GrpcOutcome> {
    const unary = client[prepared.method] as UnaryMethod;
    return new Promise((resolve, reject) => {
      const call = unary.call(
        client,
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
            resolve(this.#statusOf(error, client));
            return;
          }

          resolve({ kind: "replied", message: this.#jsonOf(response) });
        },
      );
      const cancel = (): void => {
        call.cancel();
      };
      signal.addEventListener("abort", cancel, { once: true });
    });
  }

  #streamed(
    client: ServiceClient,
    prepared: PreparedCall,
    metadata: Metadata,
    options: CallOptions,
    signal: AbortSignal,
  ): Promise<GrpcOutcome> {
    const streaming = client[prepared.method] as ServerStreamMethod;
    return new Promise((resolve, reject) => {
      const stream = streaming.call(
        client,
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
        received += Buffer.byteLength(JSON.stringify(json));

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

        resolve(this.#statusOf(error, client));
      });
      stream.on("end", () => {
        signal.removeEventListener("abort", cancel);
        resolve({ kind: "replied", message: messages });
      });
    });
  }

  #statusOf(error: ServiceError, client: ServiceClient): GrpcOutcome {
    const state = client.getChannel().getConnectivityState(false);
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
