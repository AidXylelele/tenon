import { z } from "zod";

export const KAFKA_CHANNEL = z.object({
  topic: z.string().min(1).optional(),
});
