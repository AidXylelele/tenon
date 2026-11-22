import type { Invitation } from "../../../domain/identity/invitations/invitation.js";
import type { InvitationToken } from "../../../domain/identity/invitations/invitation-token.js";

export abstract class InvitationRepository {
  abstract save(invitation: Invitation): Promise<void>;
  abstract find(id: string): Promise<Invitation | null>;
  abstract findByToken(token: InvitationToken): Promise<Invitation | null>;
  abstract findPendingByEmail(email: string): Promise<Invitation | null>;
}

export abstract class InvitationMailer {
  abstract sendInvitation(
    invitation: Invitation,
    token: InvitationToken,
    inviterName: string,
  ): Promise<void>;
}
