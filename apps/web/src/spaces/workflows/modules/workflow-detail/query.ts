import { z } from "zod";

export const WorkflowQuery = z.object({
  tab: z.enum(["overview", "runs", "versions"]).catch("overview"),
});
