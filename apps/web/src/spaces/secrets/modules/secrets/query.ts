import { z } from "zod";

export const SecretsQuery = z.object({
  new: z
    .literal("1")
    .optional()
    .catch(undefined)
    .transform((value) => value !== undefined),
});
