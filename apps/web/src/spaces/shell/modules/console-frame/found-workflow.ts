import { z } from "zod";

export const FoundWorkflows = z.array(
  z.object({
    namespace: z.string(),
    name: z.string(),
    on: z.boolean(),
    archived: z.boolean(),
  }),
);

export type FoundWorkflow = z.infer<typeof FoundWorkflows>[number];
