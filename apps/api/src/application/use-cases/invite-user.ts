import { AccountExistsError } from '../../domain/errors.js';
import { Invitation } from '../../domain/invitation.js';
import { InvitationToken } from '../../domain/invitation-token.js';
import type {
  InvitationRepository,
  InviteUserCommand,
  Mailing,
  UserRepository,
} from '../interfaces.js';

export class InviteUser {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly mailing: Mailing,
  ) {}

  async execute(command: InviteUserCommand): Promise<Invitation> {
    const account = await this.users.findByEmail(command.email);

    if (account) throw new AccountExistsError();

    const previous = await this.invitations.findPendingByEmail(command.email);

    if (previous) {
      previous.revoke();
      await this.invitations.update(previous);
    }

    const token = InvitationToken.generate();
    const invitation = Invitation.create({
      email: command.email,
      role: command.role,
      invitedBy: command.invitedBy,
      token,
    });
    await this.invitations.add(invitation);
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
