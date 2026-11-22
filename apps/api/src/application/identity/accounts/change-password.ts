import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { AccountRefusal } from "../../../domain/identity/accounts/enums.js";
import type { ChangePasswordCommand, PasswordResult } from "./interfaces.js";
import { AccountRepository, PasswordHasher, Sessions } from "./ports.js";

@Injectable()
export class ChangePassword {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly passwords: PasswordHasher,
    private readonly sessions: Sessions,
  ) {}

  @Transactional()
  async execute(command: ChangePasswordCommand): Promise<PasswordResult> {
    const account = await this.accounts.findByUserId(command.userId);
    const stored = account?.passwordHash ?? null;
    const matches = await this.passwords.verify(
      command.currentPassword,
      stored,
    );

    if (account === null || !matches)
      return { ok: false, failure: AccountRefusal.WrongPassword };

    const passwordHash = await this.passwords.hash(command.newPassword);
    const now = new Date();
    account.changePassword(passwordHash, now);
    await this.accounts.save(account);
    await this.sessions.endAll(command.userId, command.sessionId);
    return { ok: true, value: undefined };
  }
}
