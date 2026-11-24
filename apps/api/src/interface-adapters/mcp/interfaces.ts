import type { JsonObject, JsonValue, McpRequest } from "interpreter";

type HttpTransport = Extract<
  McpRequest["transport"],
  { readonly kind: "http" }
>;

export type HttpMcpRequest = McpRequest & {
  readonly transport: HttpTransport;
};

export type McpMethod = McpRequest["method"];

export interface McpSession {
  readonly endpoint: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly client: McpRequest["client"];
  readonly protocolVersion: string;
  readonly authorization: string | null;
}

export interface McpCall {
  readonly method: McpMethod;
  readonly params: JsonObject | null;
  readonly remaining: number | null;
}

export type McpAnswer =
  | { readonly kind: "answered"; readonly result: JsonValue }
  | { readonly kind: "outdated" }
  | {
      readonly kind: "error";
      readonly code: number;
      readonly message: string;
      readonly data: JsonValue;
    }
  | { readonly kind: "rejected"; readonly statusCode: number };

export abstract class McpClient {
  abstract speaks(protocolVersion: string): boolean;
  abstract request(
    session: McpSession,
    call: McpCall,
    signal: AbortSignal,
  ): Promise<McpAnswer>;
}
