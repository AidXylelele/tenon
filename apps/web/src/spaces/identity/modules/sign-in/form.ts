import { z } from "zod";
import { returnPath } from "./return-path";

export const SignInFields = z.object({
  email: z.string().trim(),
  password: z.string(),
  next: z.string().transform(returnPath),
});
