import type { GrpcRequest, JsonObject, JsonValue } from "interpreter";

export interface GrpcCall {
  readonly proto: string;
  readonly service: GrpcRequest["service"];
  readonly method: string;
  readonly arguments: JsonObject;
  readonly idempotencyKey: string;
  readonly authorization: string | null;
  readonly remaining: number | null;
}

export type GrpcAnswer =
  | { readonly kind: "replied"; readonly message: JsonValue }
  | {
      readonly kind: "status";
      readonly code: number;
      readonly message: string;
    }
  | { readonly kind: "unusable"; readonly detail: string };

export abstract class GrpcClient {
  abstract call(call: GrpcCall, signal: AbortSignal): Promise<GrpcAnswer>;
}
