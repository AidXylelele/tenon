import { z } from "zod";
import { queryText } from "@/libs/routing/segment";
import { returnPath } from "./return-path";

export const SignInQuery = z.object({
  next: queryText.transform(returnPath),
  reason: z
    .enum(["ended", "signed-out", "password-set"])
    .optional()
    .catch(undefined),
});
