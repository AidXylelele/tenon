import type { ResetPasswordCommand, UserRepository } from '../interfaces.js';

export class ResetPassword {
  constructor(private readonly users: UserRepository) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    const user = await this.users.getById(command.userId);
    user.changePassword(command.passwordHash);
    await this.users.update(user);
  }
}
