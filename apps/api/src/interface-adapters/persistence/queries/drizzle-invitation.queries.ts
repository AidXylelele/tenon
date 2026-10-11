import { Injectable } from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import type {
  InvitationQueries,
  PendingInvitation,
} from '../../../application/interfaces.js';
import { Database } from '../../interfaces.js';
import { invitation as invitations } from '../schema/index.js';

@Injectable()
export class DrizzleInvitationQueries implements InvitationQueries {
  constructor(private readonly db: Database) {}

  listPending(): Promise<PendingInvitation[]> {
    return this.db
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
          eq(invitations.status, 'pending'),
          gt(invitations.expiresAt, sql`now()`),
        ),
      )
      .orderBy(invitations.createdAt);
  }
}
