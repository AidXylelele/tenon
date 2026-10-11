import type { InvitationToken } from './invitation-token.js';

export type RoleName = 'admin' | 'editor' | 'viewer';

export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export interface UserProps {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: RoleName;
  readonly passwordHash: string | null;
  readonly suspended: boolean;
  readonly createdAt: Date;
}

export interface NewUser {
  readonly email: string;
  readonly name: string;
  readonly role: RoleName;
  readonly passwordHash: string;
}

export interface InvitationProps {
  readonly id: string;
  readonly email: string;
  readonly role: RoleName;
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
  readonly role: RoleName;
  readonly invitedBy: string;
  readonly token: InvitationToken;
}
