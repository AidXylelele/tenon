import type {
  InvitationEmail,
  InvitationRepository,
  Mailing,
  PasswordHasher,
  UserRepository,
} from '../../src/application/interfaces.js';
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

  async update(user: User): Promise<void> {
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
    return this.all().find((user) => user.id === id && !user.suspended) ?? null;
  }

  async findActiveByEmail(email: string): Promise<User | null> {
    const user = await this.findByEmail(email);

    if (!user || user.suspended) return null;

    return user;
  }

  private all(): User[] {
    return [...this.users.values()];
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
        (item) => item.email === email && item.status === 'pending',
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
