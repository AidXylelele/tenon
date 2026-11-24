import type { Role } from "../../domain/identity/users/enums.js";

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

export type MailDelivery =
  | { readonly kind: "sent" }
  | { readonly kind: "refused"; readonly reason: string };

export abstract class Mailer {
  abstract sendInvitation(
    mail: QueuedMail<InvitationMailData>,
    idempotencyKey: string,
    signal: AbortSignal,
  ): Promise<MailDelivery>;
  abstract sendPasswordReset(
    mail: QueuedMail<PasswordResetMailData>,
    idempotencyKey: string,
    signal: AbortSignal,
  ): Promise<MailDelivery>;
}
