import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Account } from '../../domain/identity/account.js';
import { AccountExistsError } from '../../domain/errors.js';
import { InvitationToken } from '../../domain/identity/invitation-token.js';
import { User } from '../../domain/identity/user.js';
import {
  type AcceptedInvitation,
  type AcceptInvitationCommand,
  AccountRepository,
  InvitationRepository,
  PasswordHasher,
  UserRepository,
} from './ports.js';

@Injectable()
export class AcceptInvitation {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly accounts: AccountRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  @Transactional()
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
    await this.accounts.save(Account.password(user, passwordHash));
    invitation.accept(user.id);
    await this.invitations.save(invitation);
    return { invitation, user };
  }
}
