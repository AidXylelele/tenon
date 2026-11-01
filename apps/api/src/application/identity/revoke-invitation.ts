import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { InvitationRepository } from './ports.js';

@Injectable()
export class RevokeInvitation {
  constructor(private readonly invitations: InvitationRepository) {}

  @Transactional()
  async execute(id: string): Promise<void> {
    const invitation = await this.invitations.getById(id);
    const now = new Date();
    invitation.revoke(now);
    await this.invitations.save(invitation);
  }
}
