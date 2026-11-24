import { z } from "zod";
import { PERIODS } from "@/operations/run-periods";

export const WorkflowQuery = z.object({
  tab: z.enum(["overview", "runs", "versions"]).catch("overview"),
  period: z.enum(PERIODS).catch("24h"),
});
