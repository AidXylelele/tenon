import { Injectable } from "@nestjs/common";
import type { HttpOutcome, OpenApiRequest } from "interpreter";
import { HttpClient } from "../../../frameworks/http-client/http.client.js";
import type { CallContext } from "./interfaces.js";

@Injectable()
export class OpenApiGateway {
  constructor(private readonly client: HttpClient) {}

  perform(request: OpenApiRequest, context: CallContext): Promise<HttpOutcome> {
    return this.client.call(request, context);
  }
}
