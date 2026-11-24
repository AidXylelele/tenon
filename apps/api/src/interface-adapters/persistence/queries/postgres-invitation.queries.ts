import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { type SQL, sql } from "drizzle-orm";
import { InvitationOutcome } from "../../../application/identity/invitations/enums.js";
import type { InvitationQueries } from "../../../application/identity/invitations/queries.js";
import type { ListedInvitation } from "../../../application/identity/invitations/interfaces.js";
import { InvitationStatus } from "../../../domain/identity/invitations/enums.js";
import type { Transaction } from "../interfaces.js";
import { invitation as invitations } from "../schema/index.js";

@Injectable()
export class PostgresInvitationQueries implements InvitationQueries {
  constructor(private readonly txHost: TransactionHost<Transaction>) {}

  list(): Promise<ListedInvitation[]> {
    const outcome = this.#outcomeOf();
    return this.txHost.tx
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        outcome,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .orderBy(invitations.createdAt);
  }

  #outcomeOf(): SQL<InvitationOutcome> {
    return sql<InvitationOutcome>`case when ${invitations.status} = ${InvitationStatus.Pending} and ${invitations.expiresAt} <= now() then ${InvitationOutcome.Expired} else ${invitations.status} end`;
  }
}
