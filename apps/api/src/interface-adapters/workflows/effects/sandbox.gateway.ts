import { Injectable } from "@nestjs/common";
import type { ProcessOutcome } from "interpreter";
import { SandboxClient } from "../../../frameworks/go-judge/sandbox.client.js";
import type { SandboxedProcessRequest } from "../interfaces.js";
import type { CallContext } from "./interfaces.js";

@Injectable()
export class SandboxGateway {
  constructor(private readonly client: SandboxClient) {}

  perform(
    request: SandboxedProcessRequest,
    context: CallContext,
  ): Promise<ProcessOutcome> {
    return this.client.run(request, context);
  }
}
