import { Injectable } from "@nestjs/common";
import type { A2aRequest, RpcOutcome } from "interpreter";
import { A2aClient } from "../../../frameworks/a2a/a2a.client.js";
import type { CallContext } from "./interfaces.js";

@Injectable()
export class A2aGateway {
  constructor(private readonly client: A2aClient) {}

  perform(request: A2aRequest, context: CallContext): Promise<RpcOutcome> {
    return this.client.call(request, context);
  }
}
