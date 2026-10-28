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
    const account = await this.accounts.findByUserId(
      command.userId,
      AccountType.Password,
    );

    if (!account) {
      const user = await this.users.getById(command.userId);
      await this.accounts.save(Account.password(user, command.passwordHash));
      return;
    }

    account.changePassword(command.passwordHash);
    await this.accounts.save(account);
  }
}
