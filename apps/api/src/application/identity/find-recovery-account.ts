import { Injectable } from "@nestjs/common";
import { Missing } from "./enums.js";
import type { RecoveryResult } from "./interfaces.js";
import { AccountRepository, UserRepository } from "./ports.js";

@Injectable()
export class FindRecoveryAccount {
  constructor(
    private readonly users: UserRepository,
    private readonly accounts: AccountRepository,
  ) {}

  async execute(email: string): Promise<RecoveryResult> {
    const user = await this.users.findByEmail(email);

    if (user === null) return { ok: false, failure: Missing.User };

    const admitted = user.canSignIn();

    if (!admitted.ok) return admitted;

    const account = await this.accounts.findByUserId(user.id);
    const recovery = {
      userId: user.id,
      email: user.email,
      passwordHash: account?.passwordHash ?? null,
    };
    return { ok: true, value: recovery };
  }
}
