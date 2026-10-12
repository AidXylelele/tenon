import type {
  AccountRepository,
  InvitationEmail,
  InvitationRepository,
  Mailing,
  PasswordHasher,
  UserRepository,
} from '../../src/application/interfaces.js';
import type { Account } from '../../src/domain/account.js';
import { type AccountType, InvitationStatus } from '../../src/domain/enums.js';
import {
  InvitationNotFoundError,
  UserNotFoundError,
} from '../../src/domain/errors.js';
import type { Invitation } from '../../src/domain/invitation.js';
import type { InvitationToken } from '../../src/domain/invitation-token.js';
import type { User } from '../../src/domain/user.js';

export class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();

  constructor(...users: User[]) {
    for (const user of users) this.users.set(user.id, user);
  }

  async add(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async getById(id: string): Promise<User> {
    const user = this.users.get(id);

    if (!user) throw new UserNotFoundError();

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.all().find((user) => sameEmail(user, email)) ?? null;
  }

  async findActiveById(id: string): Promise<User | null> {
    return this.all().find((user) => user.id === id && user.isActive) ?? null;
  }

  async findActiveByEmail(email: string): Promise<User | null> {
    const user = await this.findByEmail(email);

    if (!user?.isActive) return null;

    return user;
  }

  private all(): User[] {
    return [...this.users.values()];
  }
}

export class InMemoryAccountRepository implements AccountRepository {
  readonly accounts = new Map<string, Account>();

  constructor(...accounts: Account[]) {
    for (const account of accounts) this.accounts.set(account.id, account);
  }

  async add(account: Account): Promise<void> {
    this.accounts.set(account.id, account);
  }

  async update(account: Account): Promise<void> {
    this.accounts.set(account.id, account);
  }

  async findByIdentifier(
    type: AccountType,
    identifier: string,
  ): Promise<Account | null> {
    return (
      this.all().find(
        (account) => account.type === type && account.identifier === identifier,
      ) ?? null
    );
  }

  async findByUserId(
    userId: string,
    type: AccountType,
  ): Promise<Account | null> {
    return (
      this.all().find(
        (account) => account.userId === userId && account.type === type,
      ) ?? null
    );
  }

  private all(): Account[] {
    return [...this.accounts.values()];
  }
}

export class InMemoryInvitationRepository implements InvitationRepository {
  readonly invitations = new Map<string, Invitation>();

  constructor(...invitations: Invitation[]) {
    for (const invitation of invitations) {
      this.invitations.set(invitation.id, invitation);
    }
  }

  async add(invitation: Invitation): Promise<void> {
    this.invitations.set(invitation.id, invitation);
  }

  async update(invitation: Invitation): Promise<void> {
    this.invitations.set(invitation.id, invitation);
  }

  async getById(id: string): Promise<Invitation> {
    const invitation = this.invitations.get(id);

    if (!invitation) throw new InvitationNotFoundError();

    return invitation;
  }

  async getByToken(token: InvitationToken): Promise<Invitation> {
    const invitation = this.all().find((item) => item.tokenHash === token.hash);

    if (!invitation) throw new InvitationNotFoundError();

    return invitation;
  }

  async findPendingByEmail(email: string): Promise<Invitation | null> {
    return (
      this.all().find(
        (item) =>
          item.email === email && item.status === InvitationStatus.Pending,
      ) ?? null
    );
  }

  private all(): Invitation[] {
    return [...this.invitations.values()];
  }
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  async verify(password: string, hash: string | null): Promise<boolean> {
    return hash === `hashed:${password}`;
  }
}

export class RecordingMailing implements Mailing {
  readonly sent: InvitationEmail[] = [];

  async sendInvitation(email: InvitationEmail): Promise<void> {
    this.sent.push(email);
  }
}

const sameEmail = (user: User, email: string): boolean =>
  user.email.toLowerCase() === email.toLowerCase();
