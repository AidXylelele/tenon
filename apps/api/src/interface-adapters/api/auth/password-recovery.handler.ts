import {
  AuthenticationRegistry,
  PasswordResetHandler,
  type PasswordResetAccount,
  type PasswordResetLink,
} from "@nestjs/authentication";
import { Injectable } from "@nestjs/common";
import { FindRecoveryAccount } from "../../../application/identity/find-recovery-account.js";
import { ResetPassword } from "../../../application/identity/reset-password.js";
import { SendRecoveryLink } from "../../../application/identity/send-recovery-link.js";
import { ProblemPresenter } from "../presenters/problem.presenter.js";

@Injectable()
export class PasswordRecoveryHandler extends PasswordResetHandler {
  constructor(
    private readonly findRecoveryAccount: FindRecoveryAccount,
    private readonly sendRecoveryLink: SendRecoveryLink,
    private readonly resetPassword: ResetPassword,
    private readonly problemPresenter: ProblemPresenter,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler("passwordReset", this);
  }

  async findUser(email: string): Promise<PasswordResetAccount | null> {
    const found = await this.findRecoveryAccount.execute(email);

    if (!found.ok) return null;

    const recovery = found.value;
    return {
      id: recovery.userId,
      email: recovery.email,
      passwordHash: recovery.passwordHash,
    };
  }

  send(link: PasswordResetLink): Promise<void> {
    return this.sendRecoveryLink.execute({
      to: link.email,
      link: link.url,
      expiresAt: link.expiresAt,
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const reset = await this.resetPassword.execute({ userId, passwordHash });

    if (!reset.ok) throw this.problemPresenter.of(reset.failure);
  }
}
