import type { Account } from '../../domain/identity/account.js';
import type { AccountType, Role } from '../../domain/identity/enums.js';
import type { Invitation } from '../../domain/identity/invitation.js';
import type { InvitationToken } from '../../domain/identity/invitation-token.js';
import type { User } from '../../domain/identity/user.js';

export interface AuthenticateUserCommand {
  readonly email: string;
  readonly password: string;
}

export interface ChangePasswordCommand {
  readonly userId: string;
  readonly sessionId: string | null;
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface ResetPasswordCommand {
  readonly userId: string;
  readonly passwordHash: string;
}

export interface InviteUserCommand {
  readonly email: string;
  readonly role: Role;
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

export abstract class UserRepository {
  abstract add(user: User): Promise<void>;
  abstract getById(id: string): Promise<User>;
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
}

export abstract class AccountRepository {
  abstract save(account: Account): Promise<void>;
  abstract findByEmail(email: string): Promise<Account | null>;
  abstract findByUserId(
    userId: string,
    type: AccountType,
  ): Promise<Account | null>;
}

export abstract class InvitationRepository {
  abstract save(invitation: Invitation): Promise<void>;
  abstract getById(id: string): Promise<Invitation>;
  abstract getByToken(token: InvitationToken): Promise<Invitation>;
  abstract findPendingByEmail(email: string): Promise<Invitation | null>;
}

export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(password: string, hash: string | null): Promise<boolean>;
}

export interface RecoveryAccount {
  readonly user: User;
  readonly account: Account | null;
}

export abstract class Sessions {
  abstract endAll(userId: string, except: string | null): Promise<void>;
}

export interface SendRecoveryLinkCommand {
  readonly to: string;
  readonly link: string;
  readonly expiresAt: Date;
}

export abstract class Mailing {
  abstract sendInvitation(
    invitation: Invitation,
    token: InvitationToken,
    inviterName: string,
  ): Promise<void>;
  abstract sendPasswordReset(
    to: string,
    link: string,
    expiresAt: Date,
  ): Promise<void>;
}
