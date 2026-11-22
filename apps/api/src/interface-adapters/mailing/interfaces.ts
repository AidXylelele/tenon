import type { Role } from "../../domain/identity/enums.js";

export interface InvitationMailData {
  readonly token: string;
  readonly inviterName: string;
  readonly role: Role;
  readonly expiresAt: string;
}

export interface PasswordResetMailData {
  readonly link: string;
  readonly expiresAt: string;
}

export interface QueuedMail<T> {
  readonly to: string;
  readonly data: T;
}
