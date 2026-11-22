import type {
  CallOptions,
  ClientReadableStream,
  ClientUnaryCall,
  Metadata,
  requestCallback,
  ServiceClientConstructor,
} from "@grpc/grpc-js";
import type { Failure } from "interpreter";
import type { Message, Root } from "protobufjs";

export type Misconfigured = Extract<
  Failure,
  { readonly kind: "misconfigured" }
>;

export type ServiceClient = InstanceType<ServiceClientConstructor>;

export interface PreparedCall {
  readonly kind: "call";
  readonly digest: string;
  readonly service: ServiceClientConstructor;
  readonly method: string;
  readonly streamed: boolean;
  readonly argument: Message;
}

export type ParsedProto =
  { readonly kind: "root"; readonly root: Root } | Misconfigured;

export type UnaryMethod = (
  argument: Message,
  metadata: Metadata,
  options: CallOptions,
  callback: requestCallback<object>,
) => ClientUnaryCall;

export type ServerStreamMethod = (
  argument: Message,
  metadata: Metadata,
  options: CallOptions,
) => ClientReadableStream<object>;
