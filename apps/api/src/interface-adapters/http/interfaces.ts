import type {
  Failure,
  HttpRequest,
  JsonValue,
  OpenApiRequest,
} from "interpreter";
import type { BodyReading } from "./enums.js";

export interface OutboundRequest {
  readonly method: string;
  readonly uri: string;
  readonly headers: Headers;
  readonly body: string | null;
}

export type ResponseOptions = Pick<
  HttpRequest,
  "output" | "revealAuthorization"
>;

export interface HttpReply {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly content: JsonValue;
}

export interface TextReply {
  readonly statusCode: number;
  readonly text: string;
}

export type FetchedText =
  { readonly kind: "text"; readonly text: string } | Failure;

export type OpenApiOperation =
  | { readonly kind: "operation"; readonly request: OutboundRequest }
  | { readonly kind: "unusable"; readonly detail: string };

export abstract class HttpClient {
  abstract admits(uri: string): Promise<boolean>;
  abstract exchange(
    request: OutboundRequest,
    reading: BodyReading,
    signal: AbortSignal,
  ): Promise<HttpReply>;
  abstract text(
    request: OutboundRequest,
    signal: AbortSignal,
  ): Promise<TextReply>;
}

export abstract class OpenApiClient {
  abstract operationOf(
    document: string,
    request: OpenApiRequest,
  ): Promise<OpenApiOperation>;
}
