import type { InvitationQueries, PendingInvitation } from '../interfaces.js';

export class ListPendingInvitations {
  constructor(private readonly invitations: InvitationQueries) {}

  execute(): Promise<PendingInvitation[]> {
    return this.invitations.listPending();
  }
}
