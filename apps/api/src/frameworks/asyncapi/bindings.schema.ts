import { z } from "zod";

export const MQTT_OPERATION = z.object({
  qos: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(1),
  retain: z.boolean().default(false),
});

export const KAFKA_CHANNEL = z.object({
  topic: z.string().min(1).optional(),
});

export const AMQP_CHANNEL = z.object({
  is: z.enum(["routingKey", "queue"]).default("queue"),
  exchange: z.object({ name: z.string().min(1).optional() }).default({}),
  queue: z.object({ name: z.string().min(1).optional() }).default({}),
});
