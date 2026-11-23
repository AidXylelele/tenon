import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { Account } from "../../../domain/identity/accounts/account.js";
import { InvitationToken } from "../../../domain/identity/invitations/invitation-token.js";
import { User } from "../../../domain/identity/users/user.js";
import { AccountRepository, PasswordHasher } from "../accounts/ports.js";
import { Missing } from "../enums.js";
import { UserRepository } from "../users/ports.js";
import type {
  AcceptanceResult,
  AcceptInvitationCommand,
} from "./interfaces.js";
import { InvitationRepository } from "./ports.js";

@Injectable()
export class AcceptInvitation {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly accounts: AccountRepository,
    private readonly passwords: PasswordHasher,
    private readonly unitOfWork: UnitOfWork,
  ) {}

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
    const account = Account.password(user, passwordHash, now);
    await this.unitOfWork.run(async () => {
      await this.users.add(user);
      await this.accounts.save(account);
      await this.invitations.save(invitation);
    });
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
