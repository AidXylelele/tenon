import {
  AuthenticationRegistry,
  PasswordResetHandler,
  type PasswordResetAccount,
  type PasswordResetLink,
} from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import {
  AccountRepository,
  UserRepository,
} from '../../application/interfaces.js';
import { ResetPassword } from '../../application/use-cases/reset-password.js';
import { AccountType } from '../../domain/enums.js';
import { MailGateway } from '../mailing/mail.gateway.js';

@Injectable()
export class PasswordRecoveryHandler extends PasswordResetHandler {
  constructor(
    private readonly users: UserRepository,
    private readonly accounts: AccountRepository,
    private readonly resetPassword: ResetPassword,
    private readonly mail: MailGateway,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('passwordReset', this);
  }

  async findUser(email: string): Promise<PasswordResetAccount | null> {
    const user = await this.users.findActiveByEmail(email);

    if (!user) return null;

    const account = await this.accounts.findByUserId(
      user.id,
      AccountType.Password,
    );
    return {
      id: user.id,
      email: user.email,
      passwordHash: account?.passwordHash ?? null,
    };
  }

  send(link: PasswordResetLink): Promise<void> {
    return this.mail.sendPasswordReset({
      to: link.email,
      link: link.url,
      expiresAt: link.expiresAt,
    });
  }

  updatePassword(userId: string, passwordHash: string): Promise<void> {
    return this.resetPassword.execute({ userId, passwordHash });
  }
}
