import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq, gt, sql } from 'drizzle-orm';
import type {
  InvitationQueries,
  PendingInvitation,
} from '../../../application/identity/queries.js';
import { InvitationStatus } from '../../../domain/identity/enums.js';
import type { DrizzleTx } from '../interfaces.js';
import { invitation as invitations } from '../schema/index.js';

@Injectable()
export class DrizzleInvitationQueries implements InvitationQueries {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  listPending(): Promise<PendingInvitation[]> {
    return this.txHost.tx
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.status, InvitationStatus.Pending),
          gt(invitations.expiresAt, sql`now()`),
        ),
      )
      .orderBy(invitations.createdAt);
  }
}
