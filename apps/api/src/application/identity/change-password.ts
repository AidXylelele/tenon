import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AccountType } from '../../domain/identity/enums.js';
import { InvalidPasswordError } from '../../domain/errors.js';
import {
  AccountRepository,
  type ChangePasswordCommand,
  PasswordHasher,
  Sessions,
} from './ports.js';

@Injectable()
export class ChangePassword {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly passwords: PasswordHasher,
    private readonly sessions: Sessions,
  ) {}

  @Transactional()
  async execute(command: ChangePasswordCommand): Promise<void> {
    const account = await this.accounts.findByUserId(
      command.userId,
      AccountType.Password,
    );
    const matches = await this.passwords.verify(
      command.currentPassword,
      account?.passwordHash ?? null,
    );

    if (!account || !matches) throw new InvalidPasswordError();

    const passwordHash = await this.passwords.hash(command.newPassword);
    const now = new Date();
    account.changePassword(passwordHash, now);
    await this.accounts.save(account);
    await this.sessions.endAll(command.userId, command.sessionId);
  }
}
