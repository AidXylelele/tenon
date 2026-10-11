import type { InvitationRepository } from '../interfaces.js';

export class RevokeInvitation {
  constructor(private readonly invitations: InvitationRepository) {}

  async execute(id: string): Promise<void> {
    const invitation = await this.invitations.getById(id);
    invitation.revoke();
    await this.invitations.update(invitation);
  }
}
