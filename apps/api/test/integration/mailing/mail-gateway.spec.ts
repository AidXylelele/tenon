import { MailSmtpError } from "@nestjs/mail";
import { OutboxDeadLetters, type OutboxHandlerContext } from "@nestjs/outbox";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Mailing } from "../../../src/application/identity/ports.js";
import { MailHandler } from "../../../src/interface-adapters/messaging/mail.handler.js";
import { createTestApp, type TestApp } from "../../support/create-test-app.js";
import { queuedMailCount, truncateAll } from "../../support/db.js";

describe("mail queued through the outbox and sent by its handler", () => {
  let t: TestApp;
  let mailing: Mailing;
  let txHost: TransactionHost;

  beforeAll(async () => {
    t = await createTestApp();
    mailing = t.app.get(Mailing);
    txHost = t.app.get(TransactionHost);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    t.mail.clear();
  });

  const link = "http://127.0.0.1:3001/reset-password?token=abc";
  const expiresAt = new Date("2026-10-11T11:00:00.000Z");
  const queueReset = () =>
    mailing.sendPasswordReset("user@example.com", link, expiresAt);

  it("a_mail_queued_in_a_transaction_that_rolls_back_is_neither_queued_nor_sent", async () => {
    await expect(
      txHost.withTransaction(async () => {
        await queueReset();
        throw new Error("rolled back");
      }),
    ).rejects.toThrow("rolled back");
    expect(await queuedMailCount(t.db)).toBe(0);
    await t.deliverOutbox();
    expect(t.mail.mails).toHaveLength(0);
  });

  it("a_mail_queued_in_a_committed_transaction_is_rendered_and_sent_by_the_relay", async () => {
    await txHost.withTransaction(queueReset);
    expect(await queuedMailCount(t.db)).toBe(1);
    expect(t.mail.mails).toHaveLength(0);
    await t.deliverOutbox();
    const sent = t.mail.lastTo("user@example.com");
    expect(sent?.subject).toContain("Reset");
    expect(sent?.text).toContain("reset-password?token=abc");
    expect(sent?.text).toContain("2026-10-11 11:00 UTC");
  });

  it("a_mail_queued_outside_a_transaction_is_queued_as_well", async () => {
    await queueReset();
    expect(await queuedMailCount(t.db)).toBe(1);
  });

  it("a_transient_failure_keeps_the_message_queued_for_a_retry", async () => {
    t.mail.failNext(new Error("smtp unavailable"));
    await queueReset();
    await t.deliverOutbox();
    expect(t.mail.mails).toHaveLength(0);
    expect(await queuedMailCount(t.db)).toBe(1);
  });

  it("a_permanent_refusal_dead_letters_the_message_at_once", async () => {
    const refusal = new MailSmtpError("RCPT TO", {
      code: 550,
      text: "User unknown",
    });
    t.mail.failNext(refusal);
    await queueReset();
    await t.deliverOutbox();
    const deadLetters = await t.app.get(OutboxDeadLetters).list();
    expect(await queuedMailCount(t.db)).toBe(0);
    expect(deadLetters).toMatchObject([
      { topic: "mail.password-reset", reason: "rejected" },
    ]);
  });

  it("a_redelivered_message_is_sent_again_with_the_same_message_id", async () => {
    const handler = t.app.get(MailHandler);
    const context = {
      message: { id: "redelivered-message" },
      signal: new AbortController().signal,
    } as OutboxHandlerContext;
    const mail = {
      to: "user@example.com",
      data: { link, expiresAt: expiresAt.toISOString() },
    };
    await handler.sendPasswordReset(mail, context);
    await handler.sendPasswordReset(mail, context);
    const [first, second] = t.mail.filter({ to: "user@example.com" });
    expect(first?.messageId).toMatch(/^<.+@test\.local>$/);
    expect(second?.messageId).toBe(first?.messageId);
  });
});
