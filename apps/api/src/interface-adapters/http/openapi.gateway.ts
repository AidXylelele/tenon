import { Injectable } from "@nestjs/common";
import type { HttpOutcome, OpenApiRequest } from "interpreter";
import type { CallContext } from "../workflows/effects/interfaces.js";
import { HttpGateway } from "./http.gateway.js";
import { OpenApiClient } from "./interfaces.js";
import { ResourceGateway } from "./resource.gateway.js";

@Injectable()
export class OpenApiGateway {
  constructor(
    private readonly resources: ResourceGateway,
    private readonly http: HttpGateway,
    private readonly client: OpenApiClient,
  ) {}

  async perform(
    request: OpenApiRequest,
    context: CallContext,
  ): Promise<HttpOutcome> {
    const document = await this.resources.text(request.document, context);

    if (document.kind !== "text") return document;

    const operation = await this.client.operationOf(document.text, request);

    if (operation.kind === "unusable")
      return { kind: "misconfigured", detail: operation.detail };

    const authentication = request.authentication;
    return this.http.exchange(
      operation.request,
      authentication,
      request,
      context,
    );
  }
}
