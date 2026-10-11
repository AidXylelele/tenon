import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq } from 'drizzle-orm';
import {
  InvitationConflictError,
  InvitationNotFoundError,
} from '../../../domain/errors.js';
import type { Invitation } from '../../../domain/invitation.js';
import type { InvitationToken } from '../../../domain/invitation-token.js';
import type { InvitationRepository } from '../../../application/interfaces.js';
import type { DrizzleTx } from '../../interfaces.js';
import { InvitationMapper } from '../mappers/invitation.mapper.js';
import { invitation as invitations } from '../schema/index.js';

@Injectable()
export class DrizzleInvitationRepository implements InvitationRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async add(invitation: Invitation): Promise<void> {
    const inserted = await this.txHost.tx
      .insert(invitations)
      .values(InvitationMapper.toRow(invitation))
      .onConflictDoNothing()
      .returning({ id: invitations.id });

    if (inserted.length === 0) throw new InvitationConflictError();
  }

  async update(invitation: Invitation): Promise<void> {
    const updated = await this.txHost.tx
      .update(invitations)
      .set({
        ...InvitationMapper.toRow(invitation),
        version: invitation.version + 1,
      })
      .where(
        and(
          eq(invitations.id, invitation.id),
          eq(invitations.version, invitation.version),
        ),
      )
      .returning({ id: invitations.id });

    if (updated.length === 0) throw new InvitationConflictError();
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
        and(eq(invitations.email, email), eq(invitations.status, 'pending')),
      );

    if (!row) return null;

    return InvitationMapper.toEntity(row);
  }
}
