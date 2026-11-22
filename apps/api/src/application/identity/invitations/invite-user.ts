import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { Invitation } from "../../../domain/identity/invitations/invitation.js";
import { InvitationToken } from "../../../domain/identity/invitations/invitation-token.js";
import { UserRepository } from "../users/ports.js";
import type { InvitationResult, InviteUserCommand } from "./interfaces.js";
import { InvitationMailer, InvitationRepository } from "./ports.js";

@Injectable()
export class InviteUser {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly mailer: InvitationMailer,
  ) {}

  @Transactional()
  async execute(command: InviteUserCommand): Promise<InvitationResult> {
    const now = new Date();
    const holder = await this.users.findByEmail(command.email);
    const token = InvitationToken.generate();
    const created = Invitation.create({
      email: command.email,
      role: command.role,
      invitedBy: command.invitedBy,
      token,
      holder,
      now,
    });

    if (!created.ok) return created;

    const previous = await this.invitations.findPendingByEmail(command.email);

    if (previous !== null) {
      const revoked = previous.revoke(now);

      if (!revoked.ok) return revoked;

      await this.invitations.save(previous);
    }

    const invitation = created.value;
    await this.invitations.save(invitation);
    await this.mailer.sendInvitation(invitation, token, command.inviterName);
    const view = {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
    return { ok: true, value: view };
  }
}
