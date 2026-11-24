import type { OutboxHandlerContext } from "@nestjs/outbox";
import { MessageTopic } from "./enums.js";

export class MessageRetries {
  private static readonly MOST_ATTEMPTS = 36;
  private static readonly RUN_ATTEMPTS = 10;
  private static readonly COMMAND_ATTEMPTS = 5;
  private static readonly SECOND = 1_000;
  private static readonly DELAY_CAP = 60 * MessageRetries.SECOND;
  private static readonly DELIVERY_DELAY_CAP = 60 * MessageRetries.DELAY_CAP;
  private static readonly ATTEMPTS: ReadonlyMap<string, number> = new Map([
    [MessageTopic.RunBegin, MessageRetries.RUN_ATTEMPTS],
    [MessageTopic.RunRespond, MessageRetries.RUN_ATTEMPTS],
    [MessageTopic.RunReceives, MessageRetries.RUN_ATTEMPTS],
    [MessageTopic.RunEffect, MessageRetries.RUN_ATTEMPTS],
    [MessageTopic.RunProcess, MessageRetries.RUN_ATTEMPTS],
    [MessageTopic.RunTimer, MessageRetries.RUN_ATTEMPTS],
    [MessageTopic.ChildEnded, MessageRetries.RUN_ATTEMPTS],
    [MessageTopic.RunFail, MessageRetries.COMMAND_ATTEMPTS],
    [MessageTopic.CancelRequested, MessageRetries.COMMAND_ATTEMPTS],
    [MessageTopic.EventOffered, MessageRetries.COMMAND_ATTEMPTS],
    [MessageTopic.ChildrenAbandoned, MessageRetries.COMMAND_ATTEMPTS],
  ]);
  private static readonly DELAY_CAPS: ReadonlyMap<string, number> = new Map([
    [MessageTopic.DeliveryRequested, MessageRetries.DELIVERY_DELAY_CAP],
  ]);

  readonly most = MessageRetries.MOST_ATTEMPTS;

  attemptsOf(topic: string): number {
    return MessageRetries.ATTEMPTS.get(topic) ?? MessageRetries.MOST_ATTEMPTS;
  }

  retriesAfter(attempt: number, topic: string): boolean {
    const attempts = this.attemptsOf(topic);
    return attempt < attempts;
  }

  exhausted(context: OutboxHandlerContext): boolean {
    const attempts = this.attemptsOf(context.message.topic);
    return context.attempt >= attempts;
  }

  delayAfter(attempt: number, topic: string): number {
    const cap =
      MessageRetries.DELAY_CAPS.get(topic) ?? MessageRetries.DELAY_CAP;
    const doubled = MessageRetries.SECOND * 2 ** (attempt - 1);
    const delay = Math.min(cap, doubled);
    const jitter = Math.random() * (delay / 2);
    return delay / 2 + jitter;
  }
}
