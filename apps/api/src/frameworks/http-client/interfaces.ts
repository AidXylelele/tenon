import type { Failure, HttpRequest, RevealedAuthorization } from "interpreter";
import type { z } from "zod";
import type {
  OPENAPI_DOCUMENT,
  OPENAPI_OPERATION,
  OPENAPI_PATH,
} from "./openapi-document.schema.js";

export interface OutboundRequest {
  readonly method: string;
  readonly uri: string;
  readonly headers: Headers;
  readonly body: string | null;
  readonly redirect: NonNullable<RequestInit["redirect"]>;
}

export interface Signed {
  readonly response: Response;
  readonly authorization: RevealedAuthorization | null;
}

export type ResponseOptions = Pick<
  HttpRequest,
  "output" | "revealAuthorization"
>;

export type OpenApiDocument = z.infer<typeof OPENAPI_DOCUMENT>;

type OpenApiPath = z.infer<typeof OPENAPI_PATH>;

type OpenApiOperation = z.infer<typeof OPENAPI_OPERATION>;

export interface LocatedOperation {
  readonly item: OpenApiPath;
  readonly operation: OpenApiOperation;
}

export type OperationRequest =
  | { readonly kind: "operation"; readonly request: OutboundRequest }
  | Extract<Failure, { readonly kind: "misconfigured" }>;
