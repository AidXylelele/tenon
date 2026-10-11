import {
  InvalidCredentialsError,
  UserSuspendedError,
} from '../../domain/errors.js';
import type { User } from '../../domain/user.js';
import type {
  AuthenticateUserCommand,
  PasswordHasher,
  UserRepository,
} from '../interfaces.js';

export class AuthenticateUser {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  async execute(command: AuthenticateUserCommand): Promise<User> {
    const user = await this.users.findByEmail(command.email);
    const matches = await this.passwords.verify(
      command.password,
      user?.passwordHash ?? null,
    );

    if (!user || !matches) throw new InvalidCredentialsError();

    if (user.suspended) throw new UserSuspendedError();

    return user;
  }
}
