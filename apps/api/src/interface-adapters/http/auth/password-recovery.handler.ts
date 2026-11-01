import {
  AuthenticationRegistry,
  PasswordResetHandler,
  type PasswordResetAccount,
  type PasswordResetLink,
} from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import { FindRecoveryAccount } from '../../../application/identity/find-recovery-account.js';
import { ResetPassword } from '../../../application/identity/reset-password.js';
import { SendRecoveryLink } from '../../../application/identity/send-recovery-link.js';

@Injectable()
export class PasswordRecoveryHandler extends PasswordResetHandler {
  constructor(
    private readonly findRecoveryAccount: FindRecoveryAccount,
    private readonly sendRecoveryLink: SendRecoveryLink,
    private readonly resetPassword: ResetPassword,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('passwordReset', this);
  }

  async findUser(email: string): Promise<PasswordResetAccount | null> {
    const found = await this.findRecoveryAccount.execute(email);

    if (found === null) return null;

    const passwordHash = found.account?.passwordHash ?? null;
    return { id: found.user.id, email: found.user.email, passwordHash };
  }

  send(link: PasswordResetLink): Promise<void> {
    return this.sendRecoveryLink.execute({
      to: link.email,
      link: link.url,
      expiresAt: link.expiresAt,
    });
  }

  updatePassword(userId: string, passwordHash: string): Promise<void> {
    return this.resetPassword.execute({ userId, passwordHash });
  }
}
