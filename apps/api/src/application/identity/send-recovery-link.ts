import { Injectable } from "@nestjs/common";
import { Mailing } from "./ports.js";
import type { SendRecoveryLinkCommand } from "./interfaces.js";

@Injectable()
export class SendRecoveryLink {
  constructor(private readonly mailing: Mailing) {}

  execute(command: SendRecoveryLinkCommand): Promise<void> {
    return this.mailing.sendPasswordReset(
      command.to,
      command.link,
      command.expiresAt,
    );
  }
}
