import { Injectable } from "@nestjs/common";
import type { AsyncApiOutcome, AsyncApiRequest } from "interpreter";
import { AsyncApiClient } from "../../../frameworks/asyncapi/asyncapi.client.js";
import type { CallContext } from "./interfaces.js";

@Injectable()
export class AsyncApiGateway {
  constructor(private readonly client: AsyncApiClient) {}

  perform(
    request: AsyncApiRequest,
    context: CallContext,
  ): Promise<AsyncApiOutcome> {
    return this.client.publish(request, context);
  }
}
