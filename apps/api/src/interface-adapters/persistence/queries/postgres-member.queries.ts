import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { and, eq, gt, sql } from "drizzle-orm";
import { MemberStatus } from "../../../application/identity/users/enums.js";
import type { Member } from "../../../application/identity/users/interfaces.js";
import type { MemberQueries } from "../../../application/identity/users/queries.js";
import { InvitationStatus } from "../../../domain/identity/invitations/enums.js";
import type { Transaction } from "../interfaces.js";
import { invitation as invitations, user as users } from "../schema/index.js";

@Injectable()
export class PostgresMemberQueries implements MemberQueries {
  constructor(private readonly txHost: TransactionHost<Transaction>) {}

  list(): Promise<Member[]> {
    const people = this.txHost.tx
      .select({
        id: users.id,
        email: users.email,
        name: sql<string | null>`${users.name}`,
        role: users.role,
        status: sql<MemberStatus>`${users.status}`,
        since: users.createdAt,
      })
      .from(users);
    const invited = this.txHost.tx
      .select({
        id: invitations.id,
        email: invitations.email,
        name: sql<string | null>`null`,
        role: invitations.role,
        status: sql<MemberStatus>`${MemberStatus.Invited}`,
        since: invitations.createdAt,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.status, InvitationStatus.Pending),
          gt(invitations.expiresAt, sql`now()`),
        ),
      );
    return people.unionAll(invited).orderBy(sql`created_at`, sql`email`);
  }
}
