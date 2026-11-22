import { Injectable } from "@nestjs/common";
import type { SendRecoveryLinkCommand } from "./interfaces.js";
import { RecoveryMailer } from "./ports.js";

@Injectable()
export class SendRecoveryLink {
  constructor(private readonly mailer: RecoveryMailer) {}

  execute(command: SendRecoveryLinkCommand): Promise<void> {
    return this.mailer.sendPasswordReset(
      command.to,
      command.link,
      command.expiresAt,
    );
  }
}
