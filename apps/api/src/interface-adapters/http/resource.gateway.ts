import { Injectable } from "@nestjs/common";
import type {
  JsonValue,
  Resource,
  ResourceOutcome,
  ResourceRequest,
} from "interpreter";
import { Authenticator } from "../auth/authenticator.js";
import type { StepCall } from "../interpreter/interfaces.js";
import { type FetchedText, HttpClient } from "./interfaces.js";
import { TransportFault } from "./transport-fault.error.js";

@Injectable()
export class ResourceGateway {
  constructor(
    private readonly client: HttpClient,
    private readonly authenticator: Authenticator,
  ) {}

  async perform(
    request: ResourceRequest,
    step: StepCall,
  ): Promise<ResourceOutcome> {
    const fetched = await this.text(request.resource, step);

    if (fetched.kind !== "text") return fetched;

    const document = this.#documentOf(fetched.text);
    return { kind: "fetched", document };
  }

  async text(resource: Resource, step: StepCall): Promise<FetchedText> {
    try {
      return await this.#read(resource, step);
    } catch (error) {
      if (error instanceof TransportFault) return error.failure();

      throw error;
    }
  }

  async #read(resource: Resource, step: StepCall): Promise<FetchedText> {
    const endpoint = resource.endpoint;
    const authorization = await this.authenticator.authorizationOf(
      endpoint.authentication,
      step.secrets,
      step.signal,
    );

    if (authorization.kind === "forbidden") return authorization;

    if (authorization.kind === "misconfigured") return authorization;

    const headers = new Headers();

    if (authorization.kind === "header") {
      const value = this.authenticator.headerValueOf(authorization.header);
      headers.set("authorization", value);
    }

    const request = { method: "GET", uri: endpoint.uri, headers, body: null };
    const reply = await this.client.text(request, step.signal);
    const ok = reply.statusCode >= 200 && reply.statusCode <= 299;

    if (!ok) {
      const status = String(reply.statusCode);
      return {
        kind: "rejected",
        statusCode: reply.statusCode,
        detail: `The server answered the resource with status ${status}`,
      };
    }

    return { kind: "text", text: reply.text };
  }

  #documentOf(text: string): JsonValue {
    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return text;
    }
  }
}
