import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AccountExistsError } from '../../domain/errors.js';
import { Invitation } from '../../domain/identity/invitation.js';
import { InvitationToken } from '../../domain/identity/invitation-token.js';
import {
  InvitationRepository,
  type InviteUserCommand,
  Mailing,
  UserRepository,
} from './ports.js';

@Injectable()
export class InviteUser {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly mailing: Mailing,
  ) {}

  @Transactional()
  async execute(command: InviteUserCommand): Promise<Invitation> {
    const existing = await this.users.findByEmail(command.email);

    if (existing) throw new AccountExistsError();

    const previous = await this.invitations.findPendingByEmail(command.email);

    if (previous) {
      previous.revoke();
      await this.invitations.save(previous);
    }

    const token = InvitationToken.generate();
    const invitation = Invitation.create({
      email: command.email,
      role: command.role,
      invitedBy: command.invitedBy,
      token,
    });
    await this.invitations.save(invitation);
    await this.mailing.sendInvitation({
      to: invitation.email,
      token,
      inviterName: command.inviterName,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    });
    return invitation;
  }
}
