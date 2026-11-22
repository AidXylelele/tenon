import { z } from "zod";
import { queryText } from "@/libs/routing/segment";

export const WorkflowListQuery = z.object({
  status: z.enum(["active", "archived"]).catch("active"),
  cursor: queryText,
  q: queryText,
});
