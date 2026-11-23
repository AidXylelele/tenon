import { Injectable } from "@nestjs/common";
import type { McpRequest, RpcOutcome } from "interpreter";
import type { HttpMcpRequest } from "../../../frameworks/mcp/interfaces.js";
import { McpClient } from "../../../frameworks/mcp/mcp.client.js";
import type { CallContext } from "./interfaces.js";

@Injectable()
export class McpGateway {
  constructor(private readonly client: McpClient) {}

  perform(request: McpRequest, context: CallContext): Promise<RpcOutcome> {
    const overHttp = this.#overHttp(request);

    if (!overHttp)
      throw new Error(
        "The host does not perform 'mcp.stdio'; its profile refuses it at publish",
      );

    return this.client.call(request, context);
  }

  #overHttp(request: McpRequest): request is HttpMcpRequest {
    return request.transport.kind === "http";
  }
}
