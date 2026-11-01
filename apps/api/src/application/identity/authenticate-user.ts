import { Injectable } from '@nestjs/common';
import {
  InvalidCredentialsError,
  UserSuspendedError,
} from '../../domain/errors.js';
import type { User } from '../../domain/identity/user.js';
import {
  AccountRepository,
  type AuthenticateUserCommand,
  PasswordHasher,
  UserRepository,
} from './ports.js';

@Injectable()
export class AuthenticateUser {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  async execute(command: AuthenticateUserCommand): Promise<User> {
    const account = await this.accounts.findByEmail(command.email);
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
