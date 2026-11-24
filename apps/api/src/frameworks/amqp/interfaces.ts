import type { Channel, ConsumeMessage } from "amqplib";
import type { z } from "zod";
import type { AMQP_CHANNEL } from "./amqp-binding.schema.js";

export type QueueDeclaration = (channel: Channel) => Promise<string>;

export type MessageHandler = (
  channel: Channel,
  message: ConsumeMessage,
) => void;

export type AmqpBinding = z.infer<typeof AMQP_CHANNEL>;
