import { Injectable } from '@nestjs/common';
import type { Invitation } from '../../domain/identity/invitation.js';
import { InvitationToken } from '../../domain/identity/invitation-token.js';
import { InvitationRepository } from './ports.js';

@Injectable()
export class VerifyInvitationLink {
  constructor(private readonly invitations: InvitationRepository) {}

  async execute(value: string): Promise<Invitation> {
    const token = new InvitationToken(value);
    const invitation = await this.invitations.getByToken(token);
    const now = new Date();
    invitation.assertPending(now);

    return invitation;
  }
}
