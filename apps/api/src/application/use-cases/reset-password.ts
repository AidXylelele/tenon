import { Account } from '../../domain/account.js';
import { AccountType } from '../../domain/enums.js';
import type {
  AccountRepository,
  ResetPasswordCommand,
  UserRepository,
} from '../interfaces.js';

export class ResetPassword {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    const account = await this.accounts.findByUserId(
      command.userId,
      AccountType.Password,
    );

    if (!account) {
      const user = await this.users.getById(command.userId);
      await this.accounts.add(Account.password(user, command.passwordHash));
      return;
    }

    account.changePassword(command.passwordHash);
    await this.accounts.update(account);
  }
}
