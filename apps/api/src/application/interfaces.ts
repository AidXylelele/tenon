import type { RoleName } from '../domain/interfaces.js';
import type { Invitation } from '../domain/invitation.js';
import type { InvitationToken } from '../domain/invitation-token.js';
import type { User } from '../domain/user.js';

export interface AuthenticateUserCommand {
  readonly email: string;
  readonly password: string;
}

export interface ChangePasswordCommand {
  readonly userId: string;
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface ResetPasswordCommand {
  readonly userId: string;
  readonly passwordHash: string;
}

export interface InviteUserCommand {
  readonly email: string;
  readonly role: RoleName;
  readonly invitedBy: string;
  readonly inviterName: string;
}

export interface AcceptInvitationCommand {
  readonly token: string;
  readonly name: string;
  readonly password: string;
}

export interface AcceptedInvitation {
  readonly invitation: Invitation;
  readonly user: User;
}

export interface PendingInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface InvitationEmail {
  readonly to: string;
  readonly token: InvitationToken;
  readonly inviterName: string;
  readonly role: RoleName;
  readonly expiresAt: Date;
}

export abstract class UserRepository {
  abstract add(user: User): Promise<void>;
  abstract update(user: User): Promise<void>;
  abstract getById(id: string): Promise<User>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findActiveById(id: string): Promise<User | null>;
  abstract findActiveByEmail(email: string): Promise<User | null>;
}

export abstract class InvitationRepository {
  abstract add(invitation: Invitation): Promise<void>;
  abstract update(invitation: Invitation): Promise<void>;
  abstract getById(id: string): Promise<Invitation>;
  abstract getByToken(token: InvitationToken): Promise<Invitation>;
  abstract findPendingByEmail(email: string): Promise<Invitation | null>;
}

export abstract class InvitationQueries {
  abstract listPending(): Promise<PendingInvitation[]>;
}

export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(password: string, hash: string | null): Promise<boolean>;
}

export abstract class Mailing {
  abstract sendInvitation(email: InvitationEmail): Promise<void>;
}
