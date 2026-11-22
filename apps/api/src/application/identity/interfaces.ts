import type {
  AccountRefusal,
  InvitationRefusal,
  InvitationStatus,
  Role,
  UserRefusal,
} from "../../domain/identity/enums.js";
import type { User } from "../../domain/identity/user.js";
import type { Result } from "../../domain/interfaces.js";
import type { InvitationOutcome, Missing } from "./enums.js";

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

export interface SendRecoveryLinkCommand {
  readonly to: string;
  readonly link: string;
  readonly expiresAt: Date;
}

export interface SignedInUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly isAdmin: boolean;
  readonly mayChangeAutomation: boolean;
}

export interface InvitationView {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

interface RecoveryAccount {
  readonly userId: string;
  readonly email: string;
  readonly passwordHash: string | null;
}

export type SignInResult = Result<
  SignedInUser,
  AccountRefusal | UserRefusal | Missing
>;

export type SessionUserResult = Result<User, UserRefusal | Missing>;

export type RecoveryResult = Result<RecoveryAccount, UserRefusal | Missing>;

export type PasswordResult = Result<void, AccountRefusal | Missing>;

export type InvitationResult = Result<
  InvitationView,
  InvitationRefusal | Missing
>;

export type AcceptanceResult = Result<
  SignedInUser,
  InvitationRefusal | Missing
>;

export type RevocationResult = Result<void, InvitationRefusal | Missing>;

export interface Person {
  readonly id: string;
  readonly name: string;
}

export interface ListedInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly outcome: InvitationOutcome;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}
