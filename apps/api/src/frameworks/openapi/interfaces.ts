import type { z } from "zod";
import type {
  OPENAPI_DOCUMENT,
  OPENAPI_OPERATION,
  OPENAPI_PATH,
} from "./openapi-document.schema.js";

export type OpenApiDocument = z.infer<typeof OPENAPI_DOCUMENT>;

type OpenApiPath = z.infer<typeof OPENAPI_PATH>;

type OpenApiOperation = z.infer<typeof OPENAPI_OPERATION>;

export interface LocatedOperation {
  readonly item: OpenApiPath;
  readonly operation: OpenApiOperation;
}
