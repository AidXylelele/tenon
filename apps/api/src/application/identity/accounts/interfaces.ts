import type { AccountRefusal } from "../../../domain/identity/accounts/enums.js";
import type { UserRefusal } from "../../../domain/identity/users/enums.js";
import type { Result } from "../../../domain/interfaces.js";
import type { Missing } from "../enums.js";
import type { SignedInUser } from "../users/interfaces.js";

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

export interface SendRecoveryLinkCommand {
  readonly to: string;
  readonly link: string;
  readonly expiresAt: Date;
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

export type RecoveryResult = Result<RecoveryAccount, UserRefusal | Missing>;

export type PasswordResult = Result<void, AccountRefusal | Missing>;
