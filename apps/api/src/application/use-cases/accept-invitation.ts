import { Account } from '../../domain/account.js';
import { AccountExistsError } from '../../domain/errors.js';
import { InvitationToken } from '../../domain/invitation-token.js';
import { User } from '../../domain/user.js';
import type {
  AcceptedInvitation,
  AcceptInvitationCommand,
  AccountRepository,
  InvitationRepository,
  PasswordHasher,
  UserRepository,
} from '../interfaces.js';

export class AcceptInvitation {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly accounts: AccountRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  async execute(command: AcceptInvitationCommand): Promise<AcceptedInvitation> {
    const token = new InvitationToken(command.token);
    const invitation = await this.invitations.getByToken(token);
    invitation.assertPending();

    const existing = await this.users.findByEmail(invitation.email);

    if (existing) throw new AccountExistsError();

    const user = User.create({
      email: invitation.email,
      name: command.name,
      role: invitation.role,
    });
    const passwordHash = await this.passwords.hash(command.password);
    await this.users.add(user);
    await this.accounts.add(Account.password(user, passwordHash));
    invitation.accept(user.id);
    await this.invitations.update(invitation);
    return { invitation, user };
  }
}
