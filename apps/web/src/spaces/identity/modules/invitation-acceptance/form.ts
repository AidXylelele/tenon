import { z } from "zod";

export const AcceptanceFields = z.object({
  token: z.string(),
  name: z.string().trim(),
  password: z.string(),
});
