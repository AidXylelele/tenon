import { z } from "zod";

const flag = z
  .literal("1")
  .optional()
  .catch(undefined)
  .transform((value) => value !== undefined);

export const WebhooksQuery = z.object({ test: flag, new: flag });
