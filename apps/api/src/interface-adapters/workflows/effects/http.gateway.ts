import { Injectable } from "@nestjs/common";
import type { HttpOutcome, HttpRequest } from "interpreter";
import { HttpClient } from "../../../frameworks/http-client/http.client.js";
import type { CallContext } from "./interfaces.js";

@Injectable()
export class HttpGateway {
  constructor(private readonly client: HttpClient) {}

  perform(request: HttpRequest, context: CallContext): Promise<HttpOutcome> {
    return this.client.send(request, context);
  }
}
