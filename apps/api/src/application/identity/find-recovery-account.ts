import { Injectable } from '@nestjs/common';
import { AccountType } from '../../domain/identity/enums.js';
import {
  AccountRepository,
  type RecoveryAccount,
  UserRepository,
} from './ports.js';

@Injectable()
export class FindRecoveryAccount {
  constructor(
    private readonly users: UserRepository,
    private readonly accounts: AccountRepository,
  ) {}

  async execute(email: string): Promise<RecoveryAccount | null> {
    const user = await this.users.findByEmail(email);

    if (!user?.isActive) return null;

    const account = await this.accounts.findByUserId(
      user.id,
      AccountType.Password,
    );
    return { user, account };
  }
}
