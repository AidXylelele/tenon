import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { and, eq, sql } from 'drizzle-orm';
import {
  StaleWriteError,
  InvitationNotFoundError,
} from '../../../domain/errors.js';
import { InvitationStatus } from '../../../domain/identity/enums.js';
import type { Invitation } from '../../../domain/identity/invitation.js';
import type { InvitationToken } from '../../../domain/identity/invitation-token.js';
import type { InvitationRepository } from '../../../application/identity/ports.js';
import type { DrizzleTx } from '../interfaces.js';
import { InvitationMapper } from '../mappers/invitation.mapper.js';
import { invitation as invitations } from '../schema/index.js';
import { isUniqueViolation } from '../unique-violation.js';

@Injectable()
export class DrizzleInvitationRepository implements InvitationRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  @Transactional(Propagation.Mandatory)
  async save(invitation: Invitation): Promise<void> {
    const row = InvitationMapper.toRow(invitation);
    const version = invitation.version + 1;
    const upsert = this.txHost.tx
      .insert(invitations)
      .values({ ...row, version })
      .onConflictDoUpdate({
        target: invitations.id,
        set: {
          status: sql`excluded.status`,
          acceptedAt: sql`excluded.accepted_at`,
          acceptedUserId: sql`excluded.accepted_user_id`,
          revokedAt: sql`excluded.revoked_at`,
          version: sql`excluded.version`,
        },
        setWhere: eq(invitations.version, invitation.version),
      })
      .returning({ id: invitations.id });

    try {
      const saved = await upsert;

      if (saved.length === 0) throw new StaleWriteError();
    } catch (error) {
      if (isUniqueViolation(error)) throw new StaleWriteError();

      throw error;
    }
  }

  async getById(id: string): Promise<Invitation> {
    const [row] = await this.txHost.tx
      .select()
      .from(invitations)
      .where(eq(invitations.id, id));

    if (!row) throw new InvitationNotFoundError();

    return InvitationMapper.toEntity(row);
  }

  async getByToken(token: InvitationToken): Promise<Invitation> {
    const [row] = await this.txHost.tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, token.hash));

    if (!row) throw new InvitationNotFoundError();

    return InvitationMapper.toEntity(row);
  }

  async findPendingByEmail(email: string): Promise<Invitation | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.status, InvitationStatus.Pending),
        ),
      );

    if (!row) return null;

    return InvitationMapper.toEntity(row);
  }
}
