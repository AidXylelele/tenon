import { z } from "zod";

export const ResetFields = z.object({
  token: z.string(),
  password: z.string(),
});
