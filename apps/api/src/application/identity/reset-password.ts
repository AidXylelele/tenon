import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Account } from '../../domain/identity/account.js';
import { AccountType } from '../../domain/identity/enums.js';
import {
  AccountRepository,
  type ResetPasswordCommand,
  UserRepository,
} from './ports.js';

@Injectable()
export class ResetPassword {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly users: UserRepository,
  ) {}

  @Transactional()
  async execute(command: ResetPasswordCommand): Promise<void> {
    const now = new Date();
    const account = await this.accounts.findByUserId(
      command.userId,
      AccountType.Password,
    );

    if (!account) {
      const user = await this.users.getById(command.userId);
      const created = Account.password(user, command.passwordHash, now);
      await this.accounts.save(created);
      return;
    }

    account.changePassword(command.passwordHash, now);
    await this.accounts.save(account);
  }
}
