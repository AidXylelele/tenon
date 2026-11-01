import { Invitation } from '../../../domain/identity/invitation.js';
import type { InvitationRow } from '../interfaces.js';

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
      id: row.id,
      email: row.email,
      role: row.role,
      tokenHash: row.tokenHash,
      status: row.status,
      expiresAt: row.expiresAt,
      invitedBy: row.invitedBy,
      acceptedAt: row.acceptedAt,
      acceptedUserId: row.acceptedUserId,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
      version: row.version,
    });
  }
}
