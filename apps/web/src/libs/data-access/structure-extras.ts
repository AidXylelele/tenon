import { z } from "zod";

const InputSchema = z.object({ format: z.string(), document: z.json() });

export const StructureExtras = z.object({
  summary: z.string().nullable().catch(null),
  input: z
    .object({ schema: InputSchema.nullable().catch(null) })
    .catch({ schema: null }),
});
