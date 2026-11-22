import { Injectable } from "@nestjs/common";
import {
  Propagation,
  Transactional,
  TransactionHost,
} from "@nestjs-cls/transactional";
import { and, eq } from "drizzle-orm";
import { StaleWriteError } from "../../../domain/stale-write.error.js";
import { InvitationStatus } from "../../../domain/identity/invitations/enums.js";
import type { Invitation } from "../../../domain/identity/invitations/invitation.js";
import type { InvitationToken } from "../../../domain/identity/invitations/invitation-token.js";
import type { InvitationRepository } from "../../../application/identity/invitations/ports.js";
import type { Transaction } from "../interfaces.js";
import { InvitationMapper } from "../mappers/invitation.mapper.js";
import { invitation as invitations } from "../schema/index.js";

@Injectable()
export class PostgresInvitationRepository implements InvitationRepository {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly invitationMapper: InvitationMapper,
  ) {}

  @Transactional(Propagation.Mandatory)
  async save(invitation: Invitation): Promise<void> {
    const row = this.invitationMapper.toRow(invitation);
    const version = invitation.version + 1;
    const saved =
      invitation.version === 0
        ? await this.txHost.tx
            .insert(invitations)
            .values({ ...row, version: version })
            .onConflictDoNothing()
            .returning({ id: invitations.id })
        : await this.txHost.tx
            .update(invitations)
            .set({
              status: row.status,
              acceptedAt: row.acceptedAt,
              acceptedUserId: row.acceptedUserId,
              revokedAt: row.revokedAt,
              version: version,
            })
            .where(
              and(
                eq(invitations.id, row.id),
                eq(invitations.version, invitation.version),
              ),
            )
            .returning({ id: invitations.id });

    if (saved.length === 0) throw new StaleWriteError();
  }

  async find(id: string): Promise<Invitation | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(invitations)
      .where(eq(invitations.id, id));

    if (!row) return null;

    return this.invitationMapper.toEntity(row);
  }

  async findByToken(token: InvitationToken): Promise<Invitation | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, token.hash));

    if (!row) return null;

    return this.invitationMapper.toEntity(row);
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

    return this.invitationMapper.toEntity(row);
  }
}
