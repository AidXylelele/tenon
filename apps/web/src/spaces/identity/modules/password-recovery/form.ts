import { z } from "zod";

export const RecoveryFields = z.object({ email: z.string().trim() });
