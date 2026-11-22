import { Injectable } from "@nestjs/common";
import { AccountRefusal } from "../../domain/identity/enums.js";
import { Missing } from "./enums.js";
import type { AuthenticateUserCommand, SignInResult } from "./interfaces.js";
import { AccountRepository, PasswordHasher, UserRepository } from "./ports.js";

@Injectable()
export class AuthenticateUser {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  async execute(command: AuthenticateUserCommand): Promise<SignInResult> {
    const account = await this.accounts.findByEmail(command.email);
    const matches = await this.passwords.verify(
      command.password,
      account?.passwordHash ?? null,
    );

    if (account === null || !matches)
      return { ok: false, failure: AccountRefusal.InvalidCredentials };

    const user = await this.users.find(account.userId);

    if (user === null) return { ok: false, failure: Missing.User };

    const admitted = user.canSignIn();

    if (!admitted.ok) return admitted;

    const signedIn = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isAdmin: user.isAdmin,
      mayChangeAutomation: user.mayChangeAutomation,
    };
    return { ok: true, value: signedIn };
  }
}
