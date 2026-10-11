import type { Invitation } from '../../domain/invitation.js';
import { InvitationToken } from '../../domain/invitation-token.js';
import type { InvitationRepository } from '../interfaces.js';

export class VerifyInvitationLink {
  constructor(private readonly invitations: InvitationRepository) {}

  async execute(value: string): Promise<Invitation> {
    const token = new InvitationToken(value);
    const invitation = await this.invitations.getByToken(token);
    invitation.assertPending();

    return invitation;
  }
}
