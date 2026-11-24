import { type CallOptions, Metadata, status } from "@grpc/grpc-js";
import { Injectable } from "@nestjs/common";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import type { JsonValue } from "interpreter";
import type {
  GrpcAnswer,
  GrpcCall,
  GrpcClient,
} from "../../interface-adapters/grpc/interfaces.js";
import { TransportFailure } from "../../interface-adapters/http/enums.js";
import { TransportFault } from "../../interface-adapters/http/transport-fault.error.js";
import { ResponseSizeLimit } from "../http/response-size-limit.js";
import { TransportFaults } from "../http/transport-faults.js";
import { GrpcConnection } from "./grpc.connection.js";
import type {
  ChannelAnswer,
  ChannelCall,
  FailedAnswer,
  MessageCheck,
  PreparedCall,
} from "./interfaces.js";
import { ProtoSchema } from "./proto-schema.js";

@Injectable()
export class ProtoGrpcClient implements GrpcClient {
  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly connection: GrpcConnection,
    private readonly schema: ProtoSchema,
    private readonly faults: TransportFaults,
    private readonly limit: ResponseSizeLimit,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("grpc-calls");
  }

  async call(call: GrpcCall, signal: AbortSignal): Promise<GrpcAnswer> {
    const prepared = this.schema.preparedOf(call);

    if (prepared.kind === "unusable") return prepared;

    try {
      return await this.policy.execute(
        (attempt) => this.#called(call, prepared, attempt.signal),
        { signal },
      );
    } catch (error) {
      throw this.faults.of(error, signal);
    }
  }

  async #called(
    call: GrpcCall,
    prepared: PreparedCall,
    signal: AbortSignal,
  ): Promise<GrpcAnswer> {
    const address = call.service;
    const service = await this.connection.serviceOf(address.host, address.port);

    if (service === null)
      throw this.#unreachable("The host name could not be resolved");

    if (service.plaintext && call.authorization !== null)
      return {
        kind: "unusable",
        detail:
          "Credentials are not sent to a gRPC service over a plaintext channel",
      };

    signal.throwIfAborted();
    const channelCall = this.#channelCallOf(call, prepared);
    const bound = this.#boundOf();
    const answer = prepared.method.responseStream
      ? await this.connection.streamed(service, channelCall, signal, bound)
      : await this.connection.unary(service, channelCall, signal);
    return this.#answerOf(answer, signal);
  }

  #channelCallOf(call: GrpcCall, prepared: PreparedCall): ChannelCall {
    const metadata = this.#metadataOf(call);
    const options = this.#optionsOf(call.remaining);
    const method = prepared.method;
    const argument = prepared.argument;
    return { method, argument, metadata, options };
  }

  #metadataOf(call: GrpcCall): Metadata {
    const metadata = new Metadata();
    metadata.set("idempotency-key", call.idempotencyKey);

    if (call.authorization !== null)
      metadata.set("authorization", call.authorization);

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

  #answerOf(answer: ChannelAnswer, signal: AbortSignal): GrpcAnswer {
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

  #failureOf(answer: FailedAnswer, signal: AbortSignal): GrpcAnswer {
    if (signal.aborted) throw answer.error;

    const error = answer.error;
    const unconnected = error.code === status.UNAVAILABLE && !answer.connected;

    if (unconnected)
      throw this.#unreachable("The service could not be reached");

    return { kind: "status", code: error.code, message: error.details };
  }

  #jsonOf(message: object | undefined): JsonValue {
    const defined = message ?? null;
    const text = JSON.stringify(defined);
    return JSON.parse(text) as JsonValue;
  }

  #unreachable(detail: string): TransportFault {
    return new TransportFault(TransportFailure.Unreachable, detail);
  }
}
