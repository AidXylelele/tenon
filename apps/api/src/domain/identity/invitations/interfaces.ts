import type { Role } from "../users/enums.js";
import type { User } from "../users/user.js";
import type { InvitationStatus } from "./enums.js";
import type { InvitationToken } from "./invitation-token.js";

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
  readonly holder: User | null;
  readonly now: Date;
}
