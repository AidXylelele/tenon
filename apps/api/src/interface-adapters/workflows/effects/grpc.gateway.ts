import { Injectable } from "@nestjs/common";
import type { GrpcOutcome, GrpcRequest } from "interpreter";
import { GrpcClient } from "../../../frameworks/grpc/grpc.client.js";
import type { CallContext } from "./interfaces.js";

@Injectable()
export class GrpcGateway {
  constructor(private readonly client: GrpcClient) {}

  perform(request: GrpcRequest, context: CallContext): Promise<GrpcOutcome> {
    return this.client.call(request, context);
  }
}
