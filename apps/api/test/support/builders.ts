import { Account } from '../../src/domain/identity/account.js';
import { Role, UserStatus } from '../../src/domain/identity/enums.js';
import type { UserProps } from '../../src/domain/identity/interfaces.js';
import { Invitation } from '../../src/domain/identity/invitation.js';
import { InvitationToken } from '../../src/domain/identity/invitation-token.js';
import { User } from '../../src/domain/identity/user.js';
import { FakePasswordHasher } from './fakes.js';

export const PASSWORD = 'correct-horse-battery-staple';

export const aUser = (overrides: Partial<UserProps> = {}): User =>
  new User({
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    role: Role.Viewer,
    status: UserStatus.Active,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  });

export const aPasswordAccount = (
  user: User = aUser(),
  passwordHash = `hashed:${PASSWORD}`,
): Account => Account.password(user, passwordHash);

export const anInvitation = (
  overrides: Partial<{ email: string; role: Role; invitedBy: string }> = {},
): { invitation: Invitation; token: InvitationToken } => {
  const token = InvitationToken.generate();
  const invitation = Invitation.create({
    email: 'invitee@example.com',
    role: Role.Editor,
    invitedBy: 'admin-1',
    token,
    ...overrides,
  });
  return { invitation, token };
};

export const passwords = new FakePasswordHasher();
