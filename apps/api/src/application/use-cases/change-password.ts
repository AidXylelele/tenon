import { AccountType } from '../../domain/enums.js';
import { InvalidPasswordError } from '../../domain/errors.js';
import type {
  AccountRepository,
  ChangePasswordCommand,
  PasswordHasher,
} from '../interfaces.js';

export class ChangePassword {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly passwords: PasswordHasher,
  ) {}

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
    await this.accounts.update(account);
  }
}
