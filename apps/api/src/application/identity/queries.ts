import type { Role } from '../../domain/identity/enums.js';

export interface PendingInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export abstract class InvitationQueries {
  abstract listPending(): Promise<PendingInvitation[]>;
}
