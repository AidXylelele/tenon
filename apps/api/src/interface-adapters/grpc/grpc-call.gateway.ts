import { Injectable } from "@nestjs/common";
import type { GrpcOutcome, GrpcRequest } from "interpreter";
import { Authenticator } from "../auth/authenticator.js";
import { ResourceGateway } from "../http/resource.gateway.js";
import { TransportFault } from "../http/transport-fault.error.js";
import type { CallContext } from "../workflows/effects/interfaces.js";
import { type GrpcAnswer, GrpcClient } from "./interfaces.js";

@Injectable()
export class GrpcCallGateway {
  constructor(
    private readonly client: GrpcClient,
    private readonly resources: ResourceGateway,
    private readonly authenticator: Authenticator,
  ) {}

  async perform(
    request: GrpcRequest,
    context: CallContext,
  ): Promise<GrpcOutcome> {
    const proto = await this.resources.text(request.proto, context);

    if (proto.kind !== "text") return proto;

    try {
      return await this.#called(request, proto.text, context);
    } catch (error) {
      if (error instanceof TransportFault) return error.failure();

      throw error;
    }
  }

  async #called(
    request: GrpcRequest,
    proto: string,
    context: CallContext,
  ): Promise<GrpcOutcome> {
    const authorization = await this.authenticator.authorizationOf(
      request.authentication,
      context.secrets,
      context.signal,
    );

    if (authorization.kind === "forbidden") return authorization;

    if (authorization.kind === "misconfigured") return authorization;

    const credentials =
      authorization.kind === "header"
        ? this.authenticator.headerValueOf(authorization.header)
        : null;
    const call = {
      proto,
      service: request.service,
      method: request.method,
      arguments: request.arguments,
      idempotencyKey: context.idempotencyKey,
      authorization: credentials,
      remaining: context.remaining,
    };
    const answer = await this.client.call(call, context.signal);
    return this.#outcomeOf(answer);
  }

  #outcomeOf(answer: GrpcAnswer): GrpcOutcome {
    switch (answer.kind) {
      case "replied":
        return { kind: "replied", message: answer.message };
      case "status":
        return { kind: "status", code: answer.code, message: answer.message };
      case "unusable":
        return { kind: "misconfigured", detail: answer.detail };
    }
  }
}
