import { z } from "zod";

export const OPENAPI_PARAMETER = z.looseObject({
  name: z.string(),
  in: z.string(),
  required: z.boolean().default(false),
  collectionFormat: z.string().default(""),
  explode: z.boolean().default(true),
});

export const OPENAPI_SERVER = z.looseObject({
  url: z.string(),
  variables: z
    .record(z.string(), z.looseObject({ default: z.string().optional() }))
    .default({}),
});

const REQUEST_BODY = z.looseObject({
  required: z.boolean().default(false),
  content: z.record(z.string(), z.unknown()).default({}),
});

export const OPENAPI_OPERATION = z.looseObject({
  operationId: z.string().optional(),
  parameters: z.array(OPENAPI_PARAMETER).default([]),
  requestBody: REQUEST_BODY.optional(),
  servers: z.array(OPENAPI_SERVER).optional(),
  consumes: z.array(z.string()).optional(),
  schemes: z.array(z.string()).optional(),
});

export const OPENAPI_PATH = z.looseObject({
  parameters: z.array(OPENAPI_PARAMETER).default([]),
  servers: z.array(OPENAPI_SERVER).optional(),
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
  host: z.string().optional(),
  basePath: z.string().default(""),
  schemes: z.array(z.string()).optional(),
  consumes: z.array(z.string()).optional(),
  servers: z.array(OPENAPI_SERVER).optional(),
  paths: z.record(z.string(), OPENAPI_PATH).default({}),
});
