import {
  NonRetryableMessageError,
  type OutboxHandlerContext,
  type OutboxMessage,
} from "@nestjs/outbox";
import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { MailTopic } from "../../../../src/interface-adapters/mailing/enums.js";
import {
  type InvitationMailData,
  type MailDelivery,
  Mailer,
  type PasswordResetMailData,
  type QueuedMail,
} from "../../../../src/interface-adapters/mailing/interfaces.js";
import { MailHandler } from "../../../../src/interface-adapters/mailing/mail.handler.js";
import { RecordedSpans } from "../../../support/recorded-spans.js";

class ScriptedMailer extends Mailer {
  answer: MailDelivery | Error = { kind: "sent" };
  readonly keys: string[] = [];

  sendInvitation(
    _mail: QueuedMail<InvitationMailData>,
    idempotencyKey: string,
  ): Promise<MailDelivery> {
    return this.#answered(idempotencyKey);
  }

  sendPasswordReset(
    _mail: QueuedMail<PasswordResetMailData>,
    idempotencyKey: string,
  ): Promise<MailDelivery> {
    return this.#answered(idempotencyKey);
  }

  #answered(idempotencyKey: string): Promise<MailDelivery> {
    this.keys.push(idempotencyKey);

    if (this.answer instanceof Error) return Promise.reject(this.answer);

    return Promise.resolve(this.answer);
  }
}

const message: OutboxMessage = {
  id: "0190a1b2-0000-7000-8000-000000000001",
  topic: MailTopic.PasswordReset,
  payload: {},
  headers: {},
  key: null,
  createdAt: 0,
  availableAt: 0,
  attempts: 0,
  lastError: null,
};

const context: OutboxHandlerContext = {
  message,
  consumer: "password-reset-mail",
  attempt: 1,
  signal: new AbortController().signal,
  processInTransaction: () => Promise.reject(new Error("Not used")),
};

const mail: QueuedMail<PasswordResetMailData> = {
  to: "user@example.com",
  data: {
    link: "https://example.com/reset",
    expiresAt: "2026-11-23T00:00:00Z",
  },
};

describe("the span of a queued mail's delivery", () => {
  let spans: RecordedSpans;
  let mailer: ScriptedMailer;
  let handler: MailHandler;

  beforeEach(() => {
    spans = new RecordedSpans();
    mailer = new ScriptedMailer();
    handler = new MailHandler(mailer);
  });

  afterEach(async () => {
    await spans.stop();
  });

  it("a_delivery_is_one_consumer_span_named_after_its_topic", async () => {
    await handler.sendPasswordReset(mail, context);

    const span = spans.only("process mail.password-reset");
    expect(span.kind).toBe(SpanKind.CONSUMER);
    expect(span.attributes).toEqual({
      "messaging.system": "outbox",
      "messaging.operation.name": "process",
      "messaging.operation.type": "process",
      "messaging.destination.name": "mail.password-reset",
      "messaging.message.id": message.id,
    });
    expect(mailer.keys).toEqual([message.id]);
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
  });

  it("a_permanent_refusal_ends_the_span_as_an_error", async () => {
    mailer.answer = { kind: "refused", reason: "Mailbox unavailable" };

    const delivery = handler.sendPasswordReset(mail, context);

    await expect(delivery).rejects.toBeInstanceOf(NonRetryableMessageError);
    const span = spans.only("process mail.password-reset");
    expect(span.status).toEqual({
      code: SpanStatusCode.ERROR,
      message: "Mailbox unavailable",
    });
    expect(span.events.map((event) => event.name)).toEqual(["exception"]);
  });

  it("a_transient_failure_is_retried_and_ends_the_span_as_an_error", async () => {
    const transient = new Error("Try again later");
    mailer.answer = transient;

    const delivery = handler.sendPasswordReset(mail, context);

    await expect(delivery).rejects.toBe(transient);
    const span = spans.only("process mail.password-reset");
    const code = span.status.code;
    expect(code).toBe(SpanStatusCode.ERROR);
  });
});
