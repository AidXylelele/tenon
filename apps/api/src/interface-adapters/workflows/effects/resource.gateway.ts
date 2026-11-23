import { Injectable } from "@nestjs/common";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import type { Resource, ResourceOutcome, ResourceRequest } from "interpreter";
import type { FetchedText, ResourceClient, StepCall } from "../interfaces.js";
import { Authenticator } from "./authenticator.js";
import { HttpGateway } from "./http.gateway.js";
import type { CallContext } from "./interfaces.js";
import { ResponseContent } from "./response-content.js";
import { TransportFailures } from "./transport-failures.js";

@Injectable()
export class ResourceGateway implements ResourceClient {
  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly http: HttpGateway,
    private readonly authenticator: Authenticator,
    private readonly content: ResponseContent,
    private readonly failures: TransportFailures,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("service-calls");
  }

  async perform(
    request: ResourceRequest,
    context: CallContext,
  ): Promise<ResourceOutcome> {
    const fetched = await this.text(request.resource, context);

    if (fetched.kind !== "text") return fetched;

    const document = this.content.documentOf(fetched.text);
    return { kind: "fetched", document };
  }

  async text(resource: Resource, step: StepCall): Promise<FetchedText> {
    try {
      return await this.policy.execute(
        (attempt) => this.#textFetched(resource, step, attempt.signal),
        { signal: step.signal },
      );
    } catch (error) {
      return this.failures.of(error, step.signal);
    }
  }

  async #textFetched(
    resource: Resource,
    step: StepCall,
    signal: AbortSignal,
  ): Promise<FetchedText> {
    const endpoint = resource.endpoint;
    const authorization = await this.authenticator.authorizationOf(
      endpoint.authentication,
      step.secrets,
      signal,
    );

    if (authorization.kind === "forbidden") return authorization;

    if (authorization.kind === "misconfigured") return authorization;

    const fetch = this.http.fetchFor(authorization, signal);
    const response = await fetch(endpoint.uri);

    if (!response.ok) {
      await response.body?.cancel();
      const status = String(response.status);
      return {
        kind: "rejected",
        statusCode: response.status,
        detail: `The server answered the resource with status ${status}`,
      };
    }

    const text = await this.content.textOf(response);
    return { kind: "text", text };
  }
}
