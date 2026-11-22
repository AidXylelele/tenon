import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { Missing } from "./enums.js";
import type { RevocationResult } from "./interfaces.js";
import { InvitationRepository } from "./ports.js";

@Injectable()
export class RevokeInvitation {
  constructor(private readonly invitations: InvitationRepository) {}

  @Transactional()
  async execute(id: string): Promise<RevocationResult> {
    const invitation = await this.invitations.find(id);

    if (invitation === null) return { ok: false, failure: Missing.Invitation };

    const now = new Date();
    const revoked = invitation.revoke(now);

    if (!revoked.ok) return revoked;

    await this.invitations.save(invitation);
    return { ok: true, value: undefined };
  }
}
