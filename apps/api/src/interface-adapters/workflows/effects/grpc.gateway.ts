import { type CallOptions, Metadata, status } from "@grpc/grpc-js";
import { Injectable } from "@nestjs/common";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import type { GrpcOutcome, GrpcRequest, JsonValue } from "interpreter";
import { GrpcConnection } from "../../../frameworks/grpc/grpc.connection.js";
import type {
  FailedAnswer,
  GrpcAnswer,
  GrpcCall,
  MessageCheck,
} from "../../../frameworks/grpc/interfaces.js";
import { ResponseSizeLimit } from "../../../frameworks/network/response-size-limit.js";
import { ResourceClient } from "../interfaces.js";
import { Authenticator } from "./authenticator.js";
import type { Authorization, CallContext, PreparedCall } from "./interfaces.js";
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
    const address = request.service;
    const service = await this.connection.serviceOf(address.host, address.port);

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

    signal.throwIfAborted();
    const call = this.#callOf(prepared, context, authorization);
    const bound = this.#boundOf();
    const answer = prepared.method.responseStream
      ? await this.connection.streamed(service, call, signal, bound)
      : await this.connection.unary(service, call, signal);
    return this.#outcomeOf(answer, signal);
  }

  #callOf(
    prepared: PreparedCall,
    context: CallContext,
    authorization: Authorization,
  ): GrpcCall {
    const metadata = this.#metadataOf(context.idempotencyKey, authorization);
    const options = this.#optionsOf(context.remaining);
    const method = prepared.method;
    const argument = prepared.argument;
    return { method, argument, metadata, options };
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

  #boundOf(): MessageCheck {
    let received = 0;
    return (message) => {
      const text = JSON.stringify(message);
      received += Buffer.byteLength(text);
      return received <= this.limit.bytes;
    };
  }

  #outcomeOf(answer: GrpcAnswer, signal: AbortSignal): GrpcOutcome {
    switch (answer.kind) {
      case "message": {
        const message = this.#jsonOf(answer.message);
        return { kind: "replied", message };
      }
      case "messages": {
        const message = answer.messages.map((each) => this.#jsonOf(each));
        return { kind: "replied", message };
      }
      case "stopped": {
        const size = this.limit.inMebibytes();
        return {
          kind: "status",
          code: status.RESOURCE_EXHAUSTED,
          message: `The response is larger than ${size}`,
        };
      }
      case "failed":
        return this.#failureOf(answer, signal);
    }
  }

  #failureOf(answer: FailedAnswer, signal: AbortSignal): GrpcOutcome {
    if (signal.aborted) throw answer.error;

    const error = answer.error;
    const unconnected = error.code === status.UNAVAILABLE && !answer.connected;

    if (unconnected)
      return {
        kind: "unreachable",
        detail: "The service could not be reached",
      };

    return { kind: "status", code: error.code, message: error.details };
  }

  #jsonOf(message: object | undefined): JsonValue {
    const defined = message ?? null;
    const text = JSON.stringify(defined);
    return JSON.parse(text) as JsonValue;
  }
}
