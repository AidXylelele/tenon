import { Injectable } from "@nestjs/common";
import { InvitationOutcome } from "../../../application/identity/invitations/enums.js";
import type {
  InvitationView,
  ListedInvitation,
} from "../../../application/identity/invitations/interfaces.js";
import type { SignedInUser } from "../../../application/identity/users/interfaces.js";
import type {
  AcceptedInvitationResponse,
  InvitationListResponse,
  InvitationResponse,
  VerifiedInvitationResponse,
} from "../schemas/invitation.schema.js";
import { UserPresenter } from "./user.presenter.js";

@Injectable()
export class InvitationPresenter {
  constructor(private readonly userPresenter: UserPresenter) {}

  created(invitation: InvitationView): InvitationResponse {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: InvitationOutcome.Pending,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  list(invitations: readonly ListedInvitation[]): InvitationListResponse {
    return invitations.map((invitation) => this.#listedOf(invitation));
  }

  verified(invitation: InvitationView): VerifiedInvitationResponse {
    return {
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  accepted(user: SignedInUser): AcceptedInvitationResponse {
    const presented = this.userPresenter.user(user);
    return { user: presented };
  }

  #listedOf(invitation: ListedInvitation): InvitationResponse {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.outcome,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }
}
