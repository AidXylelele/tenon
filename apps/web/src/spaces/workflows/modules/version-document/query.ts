import { z } from "zod";

export const VersionQuery = z.object({
  view: z.enum(["flow", "code"]).catch("flow"),
});
