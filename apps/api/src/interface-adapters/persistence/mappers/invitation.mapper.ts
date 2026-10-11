import type { InvitationStatus, RoleName } from '../../../domain/interfaces.js';
import { Invitation } from '../../../domain/invitation.js';
import type { InvitationRow } from '../../interfaces.js';

export class InvitationMapper {
  static toRow(invitation: Invitation): InvitationRow {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      tokenHash: invitation.tokenHash,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      invitedBy: invitation.invitedBy,
      acceptedAt: invitation.acceptedAt,
      acceptedUserId: invitation.acceptedUserId,
      createdAt: invitation.createdAt,
      revokedAt: invitation.revokedAt,
      version: invitation.version,
    };
  }

  static toEntity(row: InvitationRow): Invitation {
    return new Invitation({
      ...row,
      role: row.role as RoleName,
      status: row.status as InvitationStatus,
    });
  }
}
