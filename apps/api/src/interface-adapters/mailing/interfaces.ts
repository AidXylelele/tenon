import type { Role } from '../../domain/identity/enums.js';
import type { InvitationToken } from '../../domain/identity/invitation-token.js';

export interface InvitationMailData {
  readonly token: InvitationToken;
  readonly inviterName: string;
  readonly role: Role;
  readonly expiresAt: Date;
}

export interface PasswordResetMailData {
  readonly link: string;
  readonly expiresAt: Date;
}
