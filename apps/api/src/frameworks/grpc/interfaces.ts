import type { CallOptions, Metadata, ServiceError } from "@grpc/grpc-js";
import type { MethodDefinition } from "@grpc/proto-loader";
import type { Message, Root } from "protobufjs";
import type { GrpcAnswer } from "../../interface-adapters/grpc/interfaces.js";

export interface ServiceAddress {
  readonly target: string;
  readonly host: string;
  readonly port: number;
  readonly plaintext: boolean;
}

export interface ChannelCall {
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

export type ChannelAnswer =
  | { readonly kind: "message"; readonly message: object | undefined }
  | { readonly kind: "messages"; readonly messages: readonly object[] }
  | { readonly kind: "stopped" }
  | FailedAnswer;

export type Unusable = Extract<GrpcAnswer, { readonly kind: "unusable" }>;

export interface PreparedCall {
  readonly kind: "call";
  readonly method: MethodDefinition<object, object>;
  readonly argument: Message;
}

export type ParsedProto =
  { readonly kind: "root"; readonly root: Root } | Unusable;
