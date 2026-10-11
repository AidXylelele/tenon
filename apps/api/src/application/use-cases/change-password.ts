import { InvalidPasswordError } from '../../domain/errors.js';
import type {
  ChangePasswordCommand,
  PasswordHasher,
  UserRepository,
} from '../interfaces.js';

export class ChangePassword {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    const user = await this.users.getById(command.userId);
    const matches = await this.passwords.verify(
      command.currentPassword,
      user.passwordHash,
    );

    if (!matches) throw new InvalidPasswordError();

    const passwordHash = await this.passwords.hash(command.newPassword);
    user.changePassword(passwordHash);
    await this.users.update(user);
  }
}
