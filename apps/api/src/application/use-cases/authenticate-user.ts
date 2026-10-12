import { AccountType } from '../../domain/enums.js';
import {
  InvalidCredentialsError,
  UserSuspendedError,
} from '../../domain/errors.js';
import type { User } from '../../domain/user.js';
import type {
  AccountRepository,
  AuthenticateUserCommand,
  PasswordHasher,
  UserRepository,
} from '../interfaces.js';

export class AuthenticateUser {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  async execute(command: AuthenticateUserCommand): Promise<User> {
    const account = await this.accounts.findByIdentifier(
      AccountType.Password,
      command.email,
    );
    const matches = await this.passwords.verify(
      command.password,
      account?.passwordHash ?? null,
    );

    if (!account || !matches) throw new InvalidCredentialsError();

    const user = await this.users.getById(account.userId);

    if (!user.isActive) throw new UserSuspendedError();

    return user;
  }
}
