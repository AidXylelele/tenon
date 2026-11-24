import { z } from "zod";

export const MQTT_OPERATION = z.object({
  qos: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(1),
  retain: z.boolean().default(false),
});
