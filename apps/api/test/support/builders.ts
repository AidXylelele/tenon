import type { RoleName } from '../../src/domain/interfaces.js';
import { Invitation } from '../../src/domain/invitation.js';
import { InvitationToken } from '../../src/domain/invitation-token.js';
import { User } from '../../src/domain/user.js';
import { FakePasswordHasher } from './fakes.js';

export const PASSWORD = 'correct-horse-battery-staple';

export const aUser = (
  overrides: Partial<{
    id: string;
    email: string;
    name: string;
    role: RoleName;
    passwordHash: string | null;
    suspended: boolean;
  }> = {},
): User =>
  new User({
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    role: 'viewer',
    passwordHash: `hashed:${PASSWORD}`,
    suspended: false,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  });

export const anInvitation = (
  overrides: Partial<{ email: string; role: RoleName; invitedBy: string }> = {},
): { invitation: Invitation; token: InvitationToken } => {
  const token = InvitationToken.generate();
  const invitation = Invitation.create({
    email: 'invitee@example.com',
    role: 'editor',
    invitedBy: 'admin-1',
    token,
    ...overrides,
  });
  return { invitation, token };
};

export const passwords = new FakePasswordHasher();
