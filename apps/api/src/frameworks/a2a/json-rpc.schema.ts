import { z } from "zod";

const JSON_RPC_VERSION = z.literal("2.0");

const JSON_RPC_ID = z.union([z.string(), z.number(), z.null()]);

const JSON_RPC_ERROR = z.object({
  code: z.int(),
  message: z.string(),
  data: z.json().default(null),
});

export const JSON_RPC_RESPONSE = z.union([
  z.object({
    jsonrpc: JSON_RPC_VERSION,
    id: JSON_RPC_ID,
    error: JSON_RPC_ERROR,
  }),
  z.object({ jsonrpc: JSON_RPC_VERSION, id: JSON_RPC_ID, result: z.json() }),
]);
