import type { OutboxHandlerContext } from "@nestjs/outbox";
import { MessageTopic } from "../../../../src/interface-adapters/messaging/enums.js";
import { MessageInbox } from "../../../../src/interface-adapters/messaging/message-inbox.js";
import { aHandlerContext } from "../../../support/outbox.js";

const TRANSACTION = { name: "tx" };

function contextRecording(duplicate: boolean): {
  readonly context: OutboxHandlerContext;
  readonly recorded: unknown[];
} {
  const recorded: unknown[] = [];
  const context: OutboxHandlerContext = {
    ...aHandlerContext(MessageTopic.RunEffect, "effects"),
    processInTransaction: async <T>(tx: unknown, work: () => T) => {
      recorded.push(tx);

      if (duplicate) return { duplicate: true as const };

      const result = await work();
      return { duplicate: false as const, result };
    },
  };
  return { context, recorded };
}

describe("the inbox a consumer records its message in", () => {
  const inbox = new MessageInbox();

  it("work_outside_a_delivery_runs_unrecorded", async () => {
    const done = await inbox.recorded(TRANSACTION, () => Promise.resolve(1));

    expect(done).toBe(1);
  });

  it("the_first_transaction_of_a_delivery_records_its_message_once", async () => {
    const { context, recorded } = contextRecording(false);
    const results: number[] = [];

    await inbox.recording(context, async () => {
      const outer = await inbox.recorded(TRANSACTION, () =>
        inbox.recorded(TRANSACTION, () => Promise.resolve(2)),
      );
      results.push(outer);
    });

    expect(results).toEqual([2]);
    expect(recorded).toEqual([TRANSACTION]);
  });

  it("a_duplicate_delivery_skips_its_work_and_ends_quietly", async () => {
    const { context } = contextRecording(true);
    const after: string[] = [];

    await inbox.recording(context, async () => {
      await inbox.recorded(TRANSACTION, () => Promise.resolve(3));
      after.push("continued");
    });

    expect(after).toEqual([]);
  });
});
