import { AccountExistsError } from '../../domain/errors.js';
import { InvitationToken } from '../../domain/invitation-token.js';
import { User } from '../../domain/user.js';
import type {
  AcceptedInvitation,
  AcceptInvitationCommand,
  InvitationRepository,
  PasswordHasher,
  UserRepository,
} from '../interfaces.js';

export class AcceptInvitation {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  async execute(command: AcceptInvitationCommand): Promise<AcceptedInvitation> {
    const token = new InvitationToken(command.token);
    const invitation = await this.invitations.getByToken(token);
    invitation.assertPending();

    const account = await this.users.findByEmail(invitation.email);

    if (account) throw new AccountExistsError();

    const passwordHash = await this.passwords.hash(command.password);
    const user = User.create({
      email: invitation.email,
      name: command.name,
      role: invitation.role,
      passwordHash,
    });
    await this.users.add(user);
    invitation.accept(user.id);
    await this.invitations.update(invitation);
    return { invitation, user };
  }
}
