import { z } from "zod";

const JSON_RPC_ERROR = z.object({
  code: z.number(),
  message: z.string(),
  data: z.json().default(null),
});

export const JSON_RPC_RESPONSE = z.union([
  z.object({ error: JSON_RPC_ERROR }),
  z.object({ result: z.json() }),
]);
