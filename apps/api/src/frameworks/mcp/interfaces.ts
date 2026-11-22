import type { McpRequest } from "interpreter";

type HttpTransport = Extract<
  McpRequest["transport"],
  { readonly kind: "http" }
>;

export type HttpMcpRequest = McpRequest & {
  readonly transport: HttpTransport;
};

export type McpMethod = McpRequest["method"];
