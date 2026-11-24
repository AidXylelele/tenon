import { z } from "zod";

export const ResetQuery = z.object({ token: z.string().min(1).catch("") });
