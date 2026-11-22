import { Injectable } from "@nestjs/common";
import { InvitationToken } from "../../../domain/identity/invitations/invitation-token.js";
import { Missing } from "../enums.js";
import type { InvitationResult } from "./interfaces.js";
import { InvitationRepository } from "./ports.js";

@Injectable()
export class VerifyInvitationLink {
  constructor(private readonly invitations: InvitationRepository) {}

  async execute(value: string): Promise<InvitationResult> {
    const token = new InvitationToken(value);
    const invitation = await this.invitations.findByToken(token);

    if (invitation === null) return { ok: false, failure: Missing.Invitation };

    const now = new Date();
    const pending = invitation.pendingAt(now);

    if (!pending.ok) return pending;

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
