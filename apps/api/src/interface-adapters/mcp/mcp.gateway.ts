import { Injectable } from "@nestjs/common";
import type {
  JsonObject,
  JsonValue,
  McpRequest,
  RpcOutcome,
} from "interpreter";
import { Authenticator } from "../auth/authenticator.js";
import { TransportFault } from "../http/transport-fault.error.js";
import type { CallContext } from "../interpreter/interfaces.js";
import {
  type HttpMcpRequest,
  type McpAnswer,
  McpClient,
} from "./interfaces.js";

@Injectable()
export class McpGateway {
  constructor(
    private readonly client: McpClient,
    private readonly authenticator: Authenticator,
  ) {}

  async perform(
    request: McpRequest,
    context: CallContext,
  ): Promise<RpcOutcome> {
    const overHttp = this.#overHttp(request);

    if (!overHttp)
      throw new Error(
        "The host does not perform 'mcp.stdio'; its profile refuses it at publish",
      );

    const spoken = this.client.speaks(request.protocolVersion);

    if (!spoken)
      return {
        kind: "misconfigured",
        detail:
          "The host does not speak this version of the Model Context Protocol",
      };

    const parameters = request.parameters;
    const unfit = parameters !== null && !this.#isObject(parameters);

    if (unfit)
      return {
        kind: "misconfigured",
        detail: "The parameters of an MCP method are an object",
      };

    try {
      return await this.#answered(request, parameters, context);
    } catch (error) {
      if (error instanceof TransportFault) return error.failure();

      throw error;
    }
  }

  async #answered(
    request: HttpMcpRequest,
    params: JsonObject | null,
    context: CallContext,
  ): Promise<RpcOutcome> {
    const transport = request.transport;
    const authorization = await this.authenticator.authorizationOf(
      transport.endpoint.authentication,
      context.secrets,
      context.signal,
    );

    if (authorization.kind === "forbidden") return authorization;

    if (authorization.kind === "misconfigured") return authorization;

    const credentials =
      authorization.kind === "header"
        ? this.authenticator.headerValueOf(authorization.header)
        : null;
    const session = {
      endpoint: transport.endpoint.uri,
      headers: transport.headers,
      client: request.client,
      protocolVersion: request.protocolVersion,
      authorization: credentials,
    };
    const call = {
      method: request.method,
      params,
      remaining: context.remaining,
    };
    const answer = await this.client.request(session, call, context.signal);
    return this.#outcomeOf(answer, request);
  }

  #outcomeOf(answer: McpAnswer, request: HttpMcpRequest): RpcOutcome {
    switch (answer.kind) {
      case "answered":
        return { kind: "answered", result: answer.result };
      case "outdated":
        return {
          kind: "misconfigured",
          detail: `The MCP server speaks a version of the protocol older than ${request.protocolVersion}`,
        };
      case "error":
        return {
          kind: "rpcError",
          code: answer.code,
          message: answer.message,
          data: answer.data,
        };
      case "rejected":
        return {
          kind: "rejected",
          statusCode: answer.statusCode,
          detail: `The MCP server answered with status ${String(answer.statusCode)}`,
        };
    }
  }

  #isObject(value: JsonValue): value is JsonObject {
    const list = Array.isArray(value);
    return typeof value === "object" && value !== null && !list;
  }

  #overHttp(request: McpRequest): request is HttpMcpRequest {
    return request.transport.kind === "http";
  }
}
