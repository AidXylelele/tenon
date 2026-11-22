import type { MethodDefinition } from "@grpc/proto-loader";
import type { Failure } from "interpreter";
import type { Message, Root } from "protobufjs";

export type Misconfigured = Extract<
  Failure,
  { readonly kind: "misconfigured" }
>;

export interface PreparedCall {
  readonly kind: "call";
  readonly method: MethodDefinition<object, object>;
  readonly argument: Message;
}

export type ParsedProto =
  { readonly kind: "root"; readonly root: Root } | Misconfigured;

export interface ServiceAddress {
  readonly target: string;
  readonly host: string;
  readonly port: number;
  readonly plaintext: boolean;
}
