import type { Invitation } from '../../../domain/invitation.js';
import type {
  AcceptedInvitation,
  PendingInvitation,
} from '../../../application/interfaces.js';
import type {
  AcceptedInvitationResponse,
  InvitationResponse,
  VerifiedInvitationResponse,
} from '../dto/responses.dto.js';
import { UserPresenter } from './user.presenter.js';

export class InvitationPresenter {
  static created(invitation: Invitation): InvitationResponse {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  static pending(invitation: PendingInvitation): InvitationResponse {
    return { ...invitation, status: 'pending' };
  }

  static verified(invitation: Invitation): VerifiedInvitationResponse {
    return {
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  static accepted(accepted: AcceptedInvitation): AcceptedInvitationResponse {
    return { user: UserPresenter.user(accepted.user) };
  }
}
