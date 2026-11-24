import { z } from "zod";

export const AMQP_CHANNEL = z.object({
  is: z.enum(["routingKey", "queue"]).default("queue"),
  exchange: z.object({ name: z.string().min(1).optional() }).default({}),
  queue: z.object({ name: z.string().min(1).optional() }).default({}),
});
