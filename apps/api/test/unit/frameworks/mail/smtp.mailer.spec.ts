import { MailError, type Mailer, type MailSendResult } from "@nestjs/mail";
import { SmtpMailer } from "../../../../src/frameworks/mail/smtp.mailer.js";

class ScriptedMailer {
  failure: Error | null = null;

  send(): Promise<MailSendResult> {
    if (this.failure !== null) return Promise.reject(this.failure);

    const sent = { messageId: "<1@example.com>", accepted: [], rejected: [] };
    return Promise.resolve(sent as unknown as MailSendResult);
  }
}

const mail = {
  to: "user@example.com",
  data: { link: "https://example.com/reset", expiresAt: "2026-11-23T00:00" },
};

describe("a mail the SMTP mailer sends", () => {
  let scripted: ScriptedMailer;
  let mailer: SmtpMailer;

  beforeEach(() => {
    scripted = new ScriptedMailer();
    mailer = new SmtpMailer(scripted as unknown as Mailer);
  });

  it("a_sent_mail_is_answered_as_sent", async () => {
    const signal = new AbortController().signal;

    const delivery = await mailer.sendPasswordReset(mail, "key-1", signal);

    expect(delivery).toEqual({ kind: "sent" });
  });

  it("a_permanent_refusal_is_answered_as_refused_with_its_reason", async () => {
    scripted.failure = new MailError("Mailbox unavailable", {
      permanent: true,
    });
    const signal = new AbortController().signal;

    const delivery = await mailer.sendPasswordReset(mail, "key-1", signal);

    expect(delivery).toEqual({
      kind: "refused",
      reason: "Mailbox unavailable",
    });
  });

  it("a_transient_failure_is_thrown_to_be_retried", async () => {
    const transient = new MailError("Try again later", { permanent: false });
    scripted.failure = transient;
    const signal = new AbortController().signal;

    const delivery = mailer.sendPasswordReset(mail, "key-1", signal);

    await expect(delivery).rejects.toBe(transient);
  });
});
