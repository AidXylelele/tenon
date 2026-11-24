import type {
  InvitationRefusal,
  InvitationStatus,
} from "../../../domain/identity/invitations/enums.js";
import type { Role } from "../../../domain/identity/users/enums.js";
import type { Result } from "../../../domain/interfaces.js";
import type { Missing } from "../enums.js";
import type { SignedInUser } from "../users/interfaces.js";
import type { InvitationOutcome } from "./enums.js";

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

export interface InvitationView {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export type InvitationResult = Result<
  InvitationView,
  InvitationRefusal | Missing
>;

export type AcceptanceResult = Result<
  SignedInUser,
  InvitationRefusal | Missing
>;

export type RevocationResult = Result<void, InvitationRefusal | Missing>;

export interface ListedInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly outcome: InvitationOutcome;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}
