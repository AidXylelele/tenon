import type {
  AccountType,
  InvitationStatus,
  Role,
  UserStatus,
} from './enums.js';
import type { InvitationToken } from './invitation-token.js';

export interface UserProps {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly status: UserStatus;
  readonly createdAt: Date;
}

export interface NewUser {
  readonly email: string;
  readonly name: string;
  readonly role: Role;
}

export interface AccountProps {
  readonly id: string;
  readonly userId: string;
  readonly type: AccountType;
  readonly identifier: string;
  readonly passwordHash: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface InvitationProps {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly tokenHash: string;
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
  readonly invitedBy: string;
  readonly acceptedAt: Date | null;
  readonly acceptedUserId: string | null;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
  readonly version: number;
}

export interface NewInvitation {
  readonly email: string;
  readonly role: Role;
  readonly invitedBy: string;
  readonly token: InvitationToken;
}
