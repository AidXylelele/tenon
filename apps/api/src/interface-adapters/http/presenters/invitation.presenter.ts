import type { AcceptedInvitation } from '../../../application/identity/ports.js';
import type { PendingInvitation } from '../../../application/identity/queries.js';
import { InvitationStatus } from '../../../domain/identity/enums.js';
import type { Invitation } from '../../../domain/identity/invitation.js';
import type {
  AcceptedInvitationResponse,
  InvitationResponse,
  VerifiedInvitationResponse,
} from '../schemas/invitation.schemas.js';
import { UserPresenter } from './user.presenter.js';

export class InvitationPresenter {
  static created(invitation: Invitation): InvitationResponse {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  static pending(invitation: PendingInvitation): InvitationResponse {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: InvitationStatus.Pending,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  static verified(invitation: Invitation): VerifiedInvitationResponse {
    return {
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  static accepted(accepted: AcceptedInvitation): AcceptedInvitationResponse {
    return { user: UserPresenter.user(accepted.user) };
  }
}
