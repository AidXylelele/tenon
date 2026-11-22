import { Injectable } from "@nestjs/common";
import type { Resource, ResourceOutcome, ResourceRequest } from "interpreter";
import { HttpClient } from "../../../frameworks/http-client/http.client.js";
import type { FetchedText, ResourceClient, StepCall } from "../interfaces.js";
import type { CallContext } from "./interfaces.js";

@Injectable()
export class ResourceGateway implements ResourceClient {
  constructor(private readonly client: HttpClient) {}

  perform(
    request: ResourceRequest,
    context: CallContext,
  ): Promise<ResourceOutcome> {
    return this.client.read(request, context);
  }

  text(resource: Resource, step: StepCall): Promise<FetchedText> {
    return this.client.text(resource, step);
  }
}
