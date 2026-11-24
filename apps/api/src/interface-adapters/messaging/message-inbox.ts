import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";
import type { OutboxHandlerContext } from "@nestjs/outbox";
import { DuplicateMessage } from "./duplicate-message.error.js";

@Injectable()
export class MessageInbox {
  private readonly delivering = new AsyncLocalStorage<OutboxHandlerContext>();

  async recording(
    context: OutboxHandlerContext,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await this.delivering.run(context, work);
    } catch (error) {
      if (error instanceof DuplicateMessage) return;

      throw error;
    }
  }

  recorded<T>(transaction: unknown, work: () => Promise<T>): Promise<T> {
    const context = this.delivering.getStore();

    if (context === undefined) return work();

    return this.delivering.exit(() =>
      this.#processed(context, transaction, work),
    );
  }

  async #processed<T>(
    context: OutboxHandlerContext,
    transaction: unknown,
    work: () => Promise<T>,
  ): Promise<T> {
    const processed = await context.processInTransaction(transaction, work);

    if (processed.duplicate) throw new DuplicateMessage(context.message.id);

    return processed.result;
  }
}
