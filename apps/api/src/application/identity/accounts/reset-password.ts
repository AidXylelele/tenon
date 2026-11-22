import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { Account } from "../../../domain/identity/accounts/account.js";
import { Missing } from "../enums.js";
import { UserRepository } from "../users/ports.js";
import type { PasswordResult, ResetPasswordCommand } from "./interfaces.js";
import { AccountRepository } from "./ports.js";

@Injectable()
export class ResetPassword {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly users: UserRepository,
  ) {}

  @Transactional()
  async execute(command: ResetPasswordCommand): Promise<PasswordResult> {
    const now = new Date();
    const account = await this.accounts.findByUserId(command.userId);

    if (account === null) {
      const user = await this.users.find(command.userId);

      if (user === null) return { ok: false, failure: Missing.User };

      const created = Account.password(user, command.passwordHash, now);
      await this.accounts.save(created);
      return { ok: true, value: undefined };
    }

    account.changePassword(command.passwordHash, now);
    await this.accounts.save(account);
    return { ok: true, value: undefined };
  }
}
