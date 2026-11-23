import { z } from "zod";

const OPENAPI_PARAMETER = z.looseObject({
  name: z.string(),
  in: z.string(),
});

const REQUEST_BODY = z.looseObject({
  required: z.boolean().default(false),
});

export const OPENAPI_OPERATION = z.looseObject({
  operationId: z.string().optional(),
  parameters: z.array(OPENAPI_PARAMETER).default([]),
  requestBody: REQUEST_BODY.optional(),
});

export const OPENAPI_PATH = z.looseObject({
  parameters: z.array(OPENAPI_PARAMETER).default([]),
  get: OPENAPI_OPERATION.optional(),
  put: OPENAPI_OPERATION.optional(),
  post: OPENAPI_OPERATION.optional(),
  delete: OPENAPI_OPERATION.optional(),
  options: OPENAPI_OPERATION.optional(),
  head: OPENAPI_OPERATION.optional(),
  patch: OPENAPI_OPERATION.optional(),
  trace: OPENAPI_OPERATION.optional(),
});

export const OPENAPI_DOCUMENT = z.looseObject({
  swagger: z.string().optional(),
  paths: z.record(z.string(), OPENAPI_PATH).default({}),
});
