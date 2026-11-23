import {
  type CallOptions,
  type Client,
  connectivityState,
  Metadata,
  type ServiceError,
  status,
} from "@grpc/grpc-js";
import { Injectable } from "@nestjs/common";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import type { GrpcOutcome, GrpcRequest, JsonValue } from "interpreter";
import { GrpcConnection } from "../../../frameworks/grpc/grpc.connection.js";
import { ResponseSizeLimit } from "../../../frameworks/network/response-size-limit.js";
import { ResourceClient } from "../interfaces.js";
import { Authenticator } from "./authenticator.js";
import type {
  Authorization,
  CallContext,
  GrpcReply,
  PreparedCall,
} from "./interfaces.js";
import { ProtoSchema } from "./proto-schema.js";
import { TransportFailures } from "./transport-failures.js";

@Injectable()
export class GrpcGateway {
  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly connection: GrpcConnection,
    private readonly resources: ResourceClient,
    private readonly authentication: Authenticator,
    private readonly schema: ProtoSchema,
    private readonly failures: TransportFailures,
    private readonly limit: ResponseSizeLimit,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("grpc-calls");
  }

  async perform(
    request: GrpcRequest,
    context: CallContext,
  ): Promise<GrpcOutcome> {
    const proto = await this.resources.text(request.proto, context);

    if (proto.kind !== "text") return proto;

    const prepared = this.schema.preparedOf(proto.text, request);

    if (prepared.kind === "misconfigured") return prepared;

    try {
      return await this.policy.execute(
        (attempt) => this.#called(request, prepared, context, attempt.signal),
        { signal: context.signal },
      );
    } catch (error) {
      return this.failures.of(error, context.signal);
    }
  }

  async #called(
    request: GrpcRequest,
    prepared: PreparedCall,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<GrpcOutcome> {
    const service = request.service;
    const channel = await this.connection.channelTo(service.host, service.port);

    if (channel === null)
      return {
        kind: "unreachable",
        detail: "The host name could not be resolved",
      };

    if (channel.plaintext && request.authentication !== null)
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

    signal.throwIfAborted();
    const client = channel.client;
    const metadata = this.#metadataOf(context.idempotencyKey, authorization);
    const options = this.#optionsOf(context.remaining);
    const reply = prepared.method.responseStream
      ? await this.#streamed(client, prepared, metadata, options, signal)
      : await this.#unary(client, prepared, metadata, options, signal);
    return this.#outcomeOf(reply, client, signal);
  }

  #metadataOf(idempotencyKey: string, authorization: Authorization): Metadata {
    const metadata = new Metadata();
    metadata.set("idempotency-key", idempotencyKey);

    if (authorization.kind === "header") {
      const value = this.authentication.headerValueOf(authorization.header);
      metadata.set("authorization", value);
    }

    return metadata;
  }

  #optionsOf(remaining: number | null): CallOptions {
    if (remaining === null) return {};

    return { deadline: Date.now() + remaining };
  }

  #unary(
    client: Client,
    prepared: PreparedCall,
    metadata: Metadata,
    options: CallOptions,
    signal: AbortSignal,
  ): Promise<GrpcReply> {
    const method = prepared.method;
    return new Promise((resolve) => {
      const call = client.makeUnaryRequest(
        method.path,
        method.requestSerialize,
        method.responseDeserialize,
        prepared.argument,
        metadata,
        options,
        (error, response) => {
          signal.removeEventListener("abort", cancel);

          if (error !== null) {
            resolve({ kind: "failed", error });
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
    client: Client,
    prepared: PreparedCall,
    metadata: Metadata,
    options: CallOptions,
    signal: AbortSignal,
  ): Promise<GrpcReply> {
    const method = prepared.method;
    const stream = client.makeServerStreamRequest(
      method.path,
      method.requestSerialize,
      method.responseDeserialize,
      prepared.argument,
      metadata,
      options,
    );
    const messages: JsonValue[] = [];
    let received = 0;
    return new Promise((resolve) => {
      const cancel = (): void => {
        stream.cancel();
      };
      signal.addEventListener("abort", cancel, { once: true });
      stream.on("data", (message: object) => {
        const json = this.#jsonOf(message);
        const text = JSON.stringify(json);
        received += Buffer.byteLength(text);

        if (received <= this.limit.bytes) {
          messages.push(json);
          return;
        }

        const exhausted = this.#exhausted();
        resolve(exhausted);
        stream.cancel();
      });
      stream.on("error", (error: ServiceError) => {
        signal.removeEventListener("abort", cancel);
        resolve({ kind: "failed", error });
      });
      stream.on("end", () => {
        signal.removeEventListener("abort", cancel);
        resolve({ kind: "replied", message: messages });
      });
    });
  }

  #outcomeOf(
    reply: GrpcReply,
    client: Client,
    signal: AbortSignal,
  ): GrpcOutcome {
    if (reply.kind !== "failed") return reply;

    if (signal.aborted) throw reply.error;

    const error = reply.error;
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

  #exhausted(): GrpcReply {
    const size = this.limit.inMebibytes();
    return {
      kind: "status",
      code: status.RESOURCE_EXHAUSTED,
      message: `The response is larger than ${size}`,
    };
  }

  #jsonOf(message: object | undefined): JsonValue {
    const defined = message ?? null;
    const text = JSON.stringify(defined);
    return JSON.parse(text) as JsonValue;
  }
}
