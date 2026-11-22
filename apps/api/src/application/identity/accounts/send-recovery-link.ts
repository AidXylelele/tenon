import { Injectable } from "@nestjs/common";
import type { SendRecoveryLinkCommand } from "./interfaces.js";
import { RecoveryMail } from "./ports.js";

@Injectable()
export class SendRecoveryLink {
  constructor(private readonly mail: RecoveryMail) {}

  execute(command: SendRecoveryLinkCommand): Promise<void> {
    return this.mail.sendPasswordReset(
      command.to,
      command.link,
      command.expiresAt,
    );
  }
}
