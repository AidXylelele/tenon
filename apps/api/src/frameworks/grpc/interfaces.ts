import type { CallOptions, Metadata, ServiceError } from "@grpc/grpc-js";
import type { MethodDefinition } from "@grpc/proto-loader";

export interface ServiceAddress {
  readonly target: string;
  readonly host: string;
  readonly port: number;
  readonly plaintext: boolean;
}

export interface GrpcCall {
  readonly method: MethodDefinition<object, object>;
  readonly argument: object;
  readonly metadata: Metadata;
  readonly options: CallOptions;
}

export type MessageCheck = (message: object) => boolean;

export interface FailedAnswer {
  readonly kind: "failed";
  readonly error: ServiceError;
  readonly connected: boolean;
}

export type GrpcAnswer =
  | { readonly kind: "message"; readonly message: object | undefined }
  | { readonly kind: "messages"; readonly messages: readonly object[] }
  | { readonly kind: "stopped" }
  | FailedAnswer;
