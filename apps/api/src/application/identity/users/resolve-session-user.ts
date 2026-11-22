import { Injectable } from "@nestjs/common";
import { Missing } from "../enums.js";
import type { SessionUserResult } from "./interfaces.js";
import { UserRepository } from "./ports.js";

@Injectable()
export class ResolveSessionUser {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<SessionUserResult> {
    const user = await this.users.find(userId);

    if (user === null) return { ok: false, failure: Missing.User };

    const admitted = user.canSignIn();

    if (!admitted.ok) return admitted;

    return { ok: true, value: user };
  }
}
