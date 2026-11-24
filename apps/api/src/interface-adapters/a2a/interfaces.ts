import type { A2aRequest, Endpoint, Failure, JsonValue } from "interpreter";

interface AdditionalInterface {
  readonly url: string;
  readonly transport: string;
}

interface SupportedInterface {
  readonly url: string;
  readonly protocolBinding: string;
  readonly protocolVersion: string;
}

export interface AgentCardData {
  readonly url: string | null;
  readonly protocolVersion: string;
  readonly preferredTransport: string;
  readonly additionalInterfaces: readonly AdditionalInterface[];
  readonly supportedInterfaces: readonly SupportedInterface[];
  readonly security: readonly unknown[];
  readonly securityRequirements: readonly unknown[];
}

export interface AgentOffer {
  readonly url: string;
  readonly binding: string;
  readonly version: string;
}

export type Agent =
  { readonly kind: "agent"; readonly endpoint: Endpoint } | Failure;

export interface A2aCall {
  readonly uri: string;
  readonly authorization: string | null;
  readonly idempotencyKey: string;
  readonly method: A2aRequest["method"];
  readonly params: JsonValue;
  readonly streamed: boolean;
}

export type JsonRpcAnswer =
  | { readonly kind: "result"; readonly result: JsonValue }
  | {
      readonly kind: "error";
      readonly code: number;
      readonly message: string;
      readonly data: JsonValue;
    }
  | { readonly kind: "unspoken" };

export interface A2aReply {
  readonly statusCode: number;
  readonly events: boolean;
  readonly answers: readonly JsonRpcAnswer[];
}

export abstract class A2aClient {
  abstract cardOf(text: string): AgentCardData | null;
  abstract call(call: A2aCall, signal: AbortSignal): Promise<A2aReply>;
}
