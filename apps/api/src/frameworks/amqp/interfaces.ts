import type { Channel, ConsumeMessage } from "amqplib";

export type QueueDeclaration = (channel: Channel) => Promise<string>;

export type MessageHandler = (
  channel: Channel,
  message: ConsumeMessage,
) => void;
