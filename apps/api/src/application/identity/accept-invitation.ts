import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { Account } from "../../domain/identity/account.js";
import { InvitationToken } from "../../domain/identity/invitation-token.js";
import { User } from "../../domain/identity/user.js";
import { Missing } from "./enums.js";
import type {
  AcceptanceResult,
  AcceptInvitationCommand,
} from "./interfaces.js";
import {
  AccountRepository,
  InvitationRepository,
  PasswordHasher,
  UserRepository,
} from "./ports.js";

@Injectable()
export class AcceptInvitation {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly accounts: AccountRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  @Transactional()
  async execute(command: AcceptInvitationCommand): Promise<AcceptanceResult> {
    const token = new InvitationToken(command.token);
    const invitation = await this.invitations.findByToken(token);

    if (invitation === null) return { ok: false, failure: Missing.Invitation };

    const now = new Date();
    const holder = await this.users.findByEmail(invitation.email);
    const user = User.create({
      email: invitation.email,
      name: command.name,
      role: invitation.role,
      now,
    });
    const accepted = invitation.accept(user, holder, now);

    if (!accepted.ok) return accepted;

    const passwordHash = await this.passwords.hash(command.password);
    await this.users.add(user);
    const account = Account.password(user, passwordHash, now);
    await this.accounts.save(account);
    await this.invitations.save(invitation);
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
