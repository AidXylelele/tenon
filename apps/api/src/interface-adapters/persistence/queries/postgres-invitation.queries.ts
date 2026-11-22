import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { type SQL, sql } from "drizzle-orm";
import { InvitationOutcome } from "../../../application/identity/enums.js";
import type { InvitationQueries } from "../../../application/identity/queries.js";
import type { ListedInvitation } from "../../../application/identity/interfaces.js";
import { InvitationStatus } from "../../../domain/identity/enums.js";
import type { Transaction } from "../interfaces.js";
import { invitation as invitations } from "../schema/index.js";

@Injectable()
export class PostgresInvitationQueries implements InvitationQueries {
  constructor(private readonly txHost: TransactionHost<Transaction>) {}

  list(): Promise<ListedInvitation[]> {
    return this.txHost.tx
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        outcome: this.#outcomeOf(),
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
