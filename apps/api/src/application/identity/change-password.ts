import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AccountType } from '../../domain/identity/enums.js';
import { InvalidPasswordError } from '../../domain/errors.js';
import {
  AccountRepository,
  type ChangePasswordCommand,
  PasswordHasher,
} from './ports.js';

@Injectable()
export class ChangePassword {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly passwords: PasswordHasher,
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
    account.changePassword(passwordHash);
    await this.accounts.save(account);
  }
}
