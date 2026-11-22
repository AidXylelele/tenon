import { z } from "zod";

export const WorkflowQuery = z.object({
  tab: z.enum(["overview", "runs", "versions"]).catch("overview"),
  start: z
    .literal("1")
    .optional()
    .catch(undefined)
    .transform((value) => value !== undefined),
});
